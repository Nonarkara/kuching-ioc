/* THE SPATIAL PROBE — the measuring instrument of the spatial law.
 *
 * It runs inside a page and measures GEOMETRY. Every number it returns is a
 * fact about what a browser actually rendered: a rect, a computed style, a
 * scroll width, a character count. It never decides whether a fact is a
 * defect. That decision belongs to the project's own policy and baseline,
 * which live on the Node side (spatial-check.mjs). That split is deliberate:
 * this file is identical in every project, so a measurement taken in one
 * project means exactly what it means in another.
 *
 * The six modes of spatial hallucination, and where each one is measured:
 *
 *   1. unjustified gaps     — a hole between two stacked siblings, or dead
 *                              space under a short cell in a row
 *   2. orphan elements      — a short cell holding a picture, stranded beside
 *                              the tall column next to it
 *   3. scattered actions    — two loud controls in one container, pushed to
 *                              opposite edges
 *   4. false hierarchy      — the title's weight against the page, and how
 *                              much of the page is set in the loud voice
 *   5. accidental wrapping  — a row that breaks and leaves one orphan on the
 *                              last row, a clipped row, or a page that scrolls
 *                              sideways
 *   6. spatially expensive  — how far down the page the first thing you can
 *                              actually DO is
 *
 * and the cost of the furniture itself:
 *
 *   7. chrome cost         — how tall the header, navigation and sticky bands
 *                              are, and how much of the viewport they take
 *   8. overlapping chrome   — a fixed or sticky band sitting ON the work
 *
 * The probe is injected into the page under test, so it must not assume
 * anything about the host: no global `window` (the document and its window
 * are passed in), no theme assumption (loudness is measured as contrast
 * against whatever is behind the element, so it works in light and dark), no
 * class names (findings are reported by tag and class so a human can find
 * them, never matched by them).
 */
(function () {
  "use strict";

  // A hole of dead space must be at least this tall to be a hole. A 24px gap
  // between two paragraphs is reading; a 200px gap is somebody's grid.
  var DEAD = 72;
  // A cell filling less than this fraction of its row band is "stranded".
  var SHORT = 0.5;
  // Two loud controls further apart than this fraction of their container
  // are "scattered".
  var EDGE = 0.55;
  // Colour distance at which a surface counts as loud against its backdrop.
  var CONTRAST = 60;

  function sel(el) {
    if (!el) return "?";
    var tag = el.tagName ? el.tagName.toLowerCase() : "?";
    if (el.id) return tag + "#" + el.id;
    // getAttribute, not el.className: for an SVG element className is an
    // SVGAnimatedString, and String() of it is "[object SVGAnimatedString]" —
    // a selector no reviewer can use to find the element in the page.
    var cls = String(el.getAttribute("class") || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (cls.length) return tag + "." + cls.join(".");
    return tag;
  }

  function parseColor(c) {
    if (!c) return null;
    var m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }

  function dist(a, b) {
    var dr = a[0] - b[0];
    var dg = a[1] - b[1];
    var db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function visible(el, win) {
    var cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (Number(cs.opacity) < 0.15) return false;
    var r = el.getBoundingClientRect();
    return !!(r.width && r.height);
  }

  function kids(el, win) {
    var out = [];
    for (var i = 0; i < el.children.length; i++) {
      if (visible(el.children[i], win)) out.push(el.children[i]);
    }
    return out;
  }

  /** The nearest opaque background behind an element. */
  function backdrop(el, win) {
    var e = el.parentElement;
    while (e) {
      var cs = win.getComputedStyle(e);
      var c = parseColor(cs.backgroundColor);
      if (c && c[3] > 0.5) return c;
      e = e.parentElement;
    }
    return [255, 255, 255, 1];
  }

  /**
   * A LOUD control: one that carries its own weight on the page.
   *
   * Loudness is measured as contrast against the surface behind it, never as
   * an absolute colour. A theme that paints its accent dark and a theme that
   * paints it light are both allowed to have one loud control; what neither
   * may have is thirty controls that all shout at once.
   */
  function loudControl(el, win) {
    var cs = win.getComputedStyle(el);
    var own = parseColor(cs.backgroundColor);
    if (own && own[3] > 0.5 && dist(own, backdrop(el, win)) > CONTRAST) return true;
    var sides = ["borderLeftWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth"];
    for (var i = 0; i < sides.length; i++) {
      if ((parseFloat(cs[sides[i]]) || 0) >= 3) return true;
    }
    return false;
  }

  /** Does this element hold a picture? An icon is not a picture. */
  function hasMedia(el) {
    var direct = /^(IMG|VIDEO|FIGURE|CANVAS|PICTURE)$/.test(el.tagName);
    if (direct) return true;
    var found = el.querySelector("img, video, figure, canvas, picture");
    if (!found) return false;
    // A tiny inline SVG is an icon, not an illustration.
    if (found.tagName === "svg" || found.tagName === "SVG") {
      var r = found.getBoundingClientRect();
      return r.width >= 80 && r.height >= 80;
    }
    return true;
  }

  function isHeading(el) {
    return /^H[1-6]$/.test(el.tagName);
  }

  /**
   * Band a list of children into rows by vertical overlap.
   *
   * One algorithm for all three layouts, because all three have the same
   * question to answer: which children share a row, and how much empty space
   * is left under the short ones. A flex row, a flex column and a grid all
   * band the same way — a column simply has one child per band.
   */
  function band(items) {
    var sorted = items.slice().sort(function (a, b) {
      return a.r.top - b.r.top;
    });
    var bands = [];
    for (var i = 0; i < sorted.length; i++) {
      var it = sorted[i];
      var last = bands[bands.length - 1];
      if (last && it.r.top < last.bottom - 4) {
        last.items.push(it);
        last.top = Math.min(last.top, it.r.top);
        last.bottom = Math.max(last.bottom, it.r.bottom);
      } else {
        bands.push({ items: [it], top: it.r.top, bottom: it.r.bottom });
      }
    }
    return bands;
  }

  function push(findings, kind, s, metric, detail) {
    for (var i = 0; i < findings.length; i++) {
      if (findings[i].kind === kind && findings[i].sel === s) {
        if (metric > findings[i].metric) {
          findings[i].metric = metric;
          findings[i].detail = detail;
        }
        return;
      }
    }
    findings.push({ kind: kind, sel: s, metric: Math.round(metric), detail: detail || "" });
  }

  function measure(route, w, d) {
    var win = d.defaultView || window;
    var rec = { route: route, w: w, findings: [] };
    var main = d.querySelector("main#content") || d.querySelector("main") || d.body;
    if (!main) {
      rec.error = "no main";
      return rec;
    }
    var F = rec.findings;

    var all = main.querySelectorAll("*");
    var doc = d.documentElement;

    // ---- 5a. the page scrolls sideways ------------------------------------
    if (doc.scrollWidth > doc.clientWidth + 1) {
      var worst = null;
      var every = d.querySelectorAll("*");
      for (var i = 0; i < every.length; i++) {
        var r = every[i].getBoundingClientRect();
        if (r.right > doc.clientWidth + 1) {
          var over = r.right - doc.clientWidth;
          if (!worst || over > worst.over) worst = { over: over, s: sel(every[i]) };
        }
      }
      push(F, "overflow", worst ? worst.s : "document", worst ? worst.over : 0,
        "the page scrolls sideways by " + Math.round(worst ? worst.over : 0) + "px");
    }

    // ---- 1 and 2. dead space, orphans --------------------------------------
    // For every container that lays its children out, band the children and
    // ask of each band: is there a hole, and is anything stranded in it?
    for (var ci = 0; ci < all.length; ci++) {
      var cont = all[ci];
      var cs = win.getComputedStyle(cont);
      var lays = cs.display === "flex" || cs.display === "grid" || cs.display === "inline-flex";
      if (!lays) continue;
      var ch = kids(cont, win);
      if (ch.length < 2) continue;

      var items = [];
      for (var k = 0; k < ch.length; k++) {
        items.push({ el: ch[k], r: ch[k].getBoundingClientRect() });
      }
      var bands = band(items);

      // The hole BETWEEN two rows. A gap beside a heading is a section break
      // — that is what whitespace is FOR — so it is not a hole. A gap in the
      // middle of a run of peers is a hole.
      for (var b = 0; b + 1 < bands.length; b++) {
        var gap = bands[b + 1].top - bands[b].bottom;
        if (gap <= DEAD) continue;
        var lower = bands[b + 1].items[0].el;
        var upper = bands[b].items[bands[b].items.length - 1].el;
        if (isHeading(lower) || isHeading(upper)) continue;
        push(F, "dead", sel(upper), gap,
          gap + "px of empty space under " + sel(upper));
      }

      // The hole UNDER a short cell in a row of taller cells.
      //
      // The hole is measured in the cell's OWN COLUMN. A band is a group of
      // children that overlap vertically, so in a two-column layout a short
      // cell in the first column shares a band with the tall column beside
      // it, and the band says the short cell leaves all that space empty.
      // It does not: the space under it is filled by the next row of its own
      // column. Measuring against the band made every two-column page look
      // like it had a void, and a gate that cries wolf on every layout is a
      // gate nobody reads.
      //
      // So: the space under a cell is empty only if no other child of the
      // container occupies the same column below it. When one does, the hole
      // ends where that child begins.
      for (var bi = 0; bi < bands.length; bi++) {
        var band1 = bands[bi];
        var bandH = band1.bottom - band1.top;
        if (bandH < DEAD) continue;
        for (var ii = 0; ii < band1.items.length; ii++) {
          var it = band1.items[ii];
          // The next child below it in the same column — the one that ends
          // the space under it, if there is one.
          var next = null;
          for (var q = 0; q < items.length; q++) {
            var o = items[q];
            if (o === it) continue;
            // Same column: their horizontal ranges overlap.
            var overlap = Math.min(o.r.right, it.r.right) - Math.max(o.r.left, it.r.left);
            if (overlap <= 0) continue;
            // Below it.
            if (o.r.top < it.r.bottom - 4) continue;
            if (!next || o.r.top < next.r.top) next = o;
          }
          var floor = next ? next.r.top : cont.getBoundingClientRect().bottom;
          var hole = floor - it.r.bottom;
          if (hole < DEAD) continue;
          if (it.r.height >= bandH * SHORT) continue;
          var kind = hasMedia(it.el) ? "orphan" : "dead";
          push(F, kind, sel(it.el), hole,
            kind === "orphan"
              ? sel(it.el) + " fills " + Math.round((it.r.height / bandH) * 100) +
                "% of a row " + Math.round(bandH) + "px tall, leaving " + Math.round(hole) + "px empty"
              : sel(it.el) + " leaves " + Math.round(hole) + "px empty beneath it in a " +
                Math.round(bandH) + "px row");
        }
      }
    }

    // ---- 5b. a row that breaks and leaves one orphan on the last row ------
    // "Navigation breaks wherever it runs out of room" is the failure. A row
    // that wraps and leaves its last item alone on a new line is the reader
    // being handed an accident. A row that wraps into two full rows is a
    // design decision, not an accident.
    //
    // Only HORIZONTAL rows are candidates. A vertical menu is not a row that
    // broke — it was always a column — and a grid's rows are the design. A
    // column flex, a block list of links and a grid are all left alone.
    function isHorizontalRow(el, cs) {
      if (cs.display === "flex" || cs.display === "inline-flex") {
        return cs.flexDirection === "row" || cs.flexDirection === "row-reverse";
      }
      if (cs.display === "grid" || cs.display === "inline-grid") return false;
      if (cs.display === "block" || cs.display === "inline") {
        // A block row of inline content is the other way a row breaks: the
        // text simply runs out of room. A block row of block children is a
        // list, and a list was always a list.
        var kk = kids(el, win);
        if (kk.length < 2) return false;
        var inlineCount = 0;
        for (var q = 0; q < kk.length; q++) {
          var d2 = win.getComputedStyle(kk[q]).display;
          if (d2 === "inline" || d2 === "inline-block" || d2 === "inline-flex" || d2 === "inline-grid") {
            inlineCount++;
          }
        }
        return inlineCount === kk.length;
      }
      return false;
    }

    var hosts = [];
    var navs = d.querySelectorAll('nav, [role="navigation"], header nav, header .topbar');
    for (var nv = 0; nv < navs.length; nv++) {
      var ncs = win.getComputedStyle(navs[nv]);
      if (!isHorizontalRow(navs[nv], ncs)) continue;
      // A nav that cannot wrap cannot break.
      var nwrap = ncs.display === "flex" || ncs.display === "inline-flex" ? ncs.flexWrap === "wrap" : true;
      if (nwrap) hosts.push({ el: navs[nv], min: 2 });
    }
    for (var wi = 0; wi < all.length; wi++) {
      var wcs = win.getComputedStyle(all[wi]);
      if (
        (wcs.display === "flex" || wcs.display === "inline-flex") &&
        (wcs.flexDirection === "row" || wcs.flexDirection === "row-reverse") &&
        wcs.flexWrap === "wrap"
      ) {
        hosts.push({ el: all[wi], min: 3 });
      }
    }
    for (var hi = 0; hi < hosts.length; hi++) {
      var host = hosts[hi];
      var hk = kids(host.el, win);
      if (hk.length < host.min) continue;
      var hitems = [];
      for (var hj = 0; hj < hk.length; hj++) {
        hitems.push({ el: hk[hj], r: hk[hj].getBoundingClientRect() });
      }
      var hbands = band(hitems);
      if (hbands.length < 2) continue;
      // A row that never held more than one item is a LIST, not a broken
      // row. A vertical list of four theme choices is four bands of one; a
      // row of four links that wrapped into two lines is two bands of two
      // and one. Only the second is an accident.
      var widest = 0;
      for (var wb = 0; wb < hbands.length; wb++) {
        if (hbands[wb].items.length > widest) widest = hbands[wb].items.length;
      }
      if (widest < 2) continue;
      var lastBand = hbands[hbands.length - 1];
      if (lastBand.items.length !== 1) continue;
      push(F, "wrap", sel(host.el), hbands.length,
        sel(host.el) + " breaks into " + hbands.length + " rows and leaves " +
        sel(lastBand.items[0].el) + " alone on the last one");
    }

    // ---- 5c. a row that is clipped rather than wrapped ---------------------
    for (var oi = 0; oi < all.length; oi++) {
      var oe = all[oi];
      if (oe === d.body || oe === doc) continue;
      var ocs = win.getComputedStyle(oe);
      if (ocs.overflowX !== "hidden" && ocs.overflowX !== "clip") continue;
      if (oe.clientWidth <= 40) continue;
      if (oe.scrollWidth > oe.clientWidth + 2) {
        // A frame that crops a picture on purpose is not a row that lost its
        // content. The palace plates are sprite crops — a 400%-wide image
        // inside a 3:4 window with overflow hidden — and that is the picture
        // working, not a defect.
        if (oe.querySelector("img, picture, video, canvas")) continue;
        push(F, "clip", sel(oe), oe.scrollWidth - oe.clientWidth,
          sel(oe) + " hides " + (oe.scrollWidth - oe.clientWidth) + "px of its own content");
      }
    }

    // ---- 3. scattered actions ----------------------------------------------
    // Two loud controls in one container, pushed to opposite edges.
    for (var si = 0; si < all.length; si++) {
      var scont = all[si];
      var scs = win.getComputedStyle(scont);
      if (scs.display !== "flex" && scs.display !== "grid" && scs.display !== "block") continue;
      var sks = kids(scont, win);
      var ctl = [];
      for (var sk = 0; sk < sks.length; sk++) {
        if (/^(A|BUTTON)$/.test(sks[sk].tagName) && loudControl(sks[sk], win)) ctl.push(sks[sk]);
      }
      if (ctl.length < 2) continue;
      var scr = scont.getBoundingClientRect();
      if (scr.width < 200) continue;
      for (var p1 = 0; p1 < ctl.length; p1++) {
        for (var p2 = p1 + 1; p2 < ctl.length; p2++) {
          var r1 = ctl[p1].getBoundingClientRect();
          var r2 = ctl[p2].getBoundingClientRect();
          var cx1 = r1.left + r1.width / 2;
          var cx2 = r2.left + r2.width / 2;
          var apart = Math.abs(cx1 - cx2) / scr.width;
          if (apart > EDGE) {
            push(F, "scattered", sel(scont), apart * 100,
              sel(ctl[p1]) + " and " + sel(ctl[p2]) + " sit " +
              Math.round(apart * 100) + "% apart in " + sel(scont));
          }
        }
      }
    }

    // ---- 4. false hierarchy ------------------------------------------------
    var h1 = main.querySelector("h1");
    var h1size = h1 ? parseFloat(win.getComputedStyle(h1).fontSize) : 0;
    var largest = 0;
    var largestInfo = null;
    var ramp = {};
    var peerChars = 0;
    var totalChars = 0;
    var peers = 0;
    for (var mi = 0; mi < all.length; mi++) {
      var el = all[mi];
      var cs2 = win.getComputedStyle(el);
      if (cs2.display === "none" || cs2.visibility === "hidden") continue;
      var r2 = el.getBoundingClientRect();
      if (!r2.width || !r2.height) continue;
      var own = "";
      for (var cn = 0; cn < el.childNodes.length; cn++) {
        if (el.childNodes[cn].nodeType === 3) own += el.childNodes[cn].nodeValue;
      }
      own = own.replace(/\s+/g, " ").trim();
      if (!own) continue;
      totalChars += own.length;
      var size = parseFloat(cs2.fontSize);
      var key = String(Math.round(size * 10) / 10);
      ramp[key] = (ramp[key] || 0) + own.length;
      if (el.tagName !== "H1" && size > largest) {
        largest = size;
        largestInfo = {
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 40),
          size: size,
          text: own.slice(0, 40),
        };
      }
      var weight = Number(cs2.fontWeight) || 400;
      if (weight >= 600 && size >= 15 && size < h1size && el.tagName !== "OPTION") {
        var loudAncestor = false;
        for (var anc = el.parentElement; anc && anc !== main; anc = anc.parentElement) {
          var acs = win.getComputedStyle(anc);
          if (
            (Number(acs.fontWeight) || 400) >= 600 &&
            parseFloat(acs.fontSize) >= 15 &&
            parseFloat(acs.fontSize) < h1size
          ) {
            loudAncestor = true;
            break;
          }
        }
        if (!loudAncestor) {
          peers++;
          peerChars += own.length;
        }
      }
    }
    rec.hierarchy = {
      h1: h1size,
      h1Count: main.querySelectorAll("h1").length,
      largest: largest,
      largestInfo: largestInfo,
      ratio: h1size && largest ? Math.round((h1size / largest) * 100) / 100 : null,
      peers: peers,
      share: totalChars ? Math.round((peerChars / totalChars) * 100) / 100 : 0,
      ramp: ramp,
    };
    rec.chars = totalChars;

    // ---- the query containers ---------------------------------------------
    // A CONTAINER query changes the layout when the CONTAINER changes size,
    // not when the window does. A sweep that only knows viewport widths can
    // walk straight past a container cliff and never see the layout on
    // either side of it. So every element that establishes a query
    // container is reported with its width: the gate can then see whether
    // the sweep ever landed on the cliff.
    var containers = [];
    var cands = main.querySelectorAll("*");
    for (var qi = 0; qi < cands.length; qi++) {
      var qc = cands[qi];
      var qcs = win.getComputedStyle(qc);
      if (!qcs.containerType || qcs.containerType === "normal") continue;
      var qcr = qc.getBoundingClientRect();
      if (!qcr.width) continue;
      containers.push({
        sel: sel(qc),
        w: Math.round(qcr.width * 100) / 100,
        name: qcs.containerName || "",
      });
    }
    rec.containers = containers;

    // ---- chrome cost, and chrome that covers the work -----------------------
    // "Chrome earns its pixels." The law asks three questions about the
    // furniture of a page: how TALL it is, how much of the VIEWPORT it
    // takes, and whether it COVERS the work.
    //
    // Chrome is what is not the work: the header, the navigation, a sticky
    // band, a fixed toolbar. It is NOT the page's own content, and it is NOT
    // furniture standing in a column — a rail down the side of the reading
    // column takes no height away from the work, so it is not chrome cost.
    var vh = win.innerHeight || d.documentElement.clientHeight || 0;
    var vw = win.innerWidth || d.documentElement.clientWidth || 0;
    var topBands = [];
    var bottomBands = [];
    // A REGION THAT COVERS THE WORK. The edge bands are the chrome of the
    // page; this is every fixed or pinned region that sits ON the work,
    // wherever it stands. A band in the middle of the screen is not chrome
    // cost, but it is still a thing lying on top of the reading.
    var coverers = [];
    var chromeNodes = d.body ? d.body.querySelectorAll("*") : [];
    for (var chi = 0; chi < chromeNodes.length; chi++) {
      var ce = chromeNodes[chi];
      if (ce === d.body || ce === d.documentElement) continue;
      var ccs = win.getComputedStyle(ce);
      if (ccs.display === "none" || ccs.visibility === "hidden") continue;
      var cpos = ccs.position;
      var cr = ce.getBoundingClientRect();
      if (!cr.width || !cr.height) continue;
      var isFixed = cpos === "fixed";
      var isSticky = cpos === "sticky";
      var inMain = ce === main || main.contains(ce);
      // A header outside main is the page's own bar; a header inside main is
      // a heading of the work, and a heading is not furniture.
      var isBar = !inMain && (ce.tagName === "HEADER" || ce.getAttribute("role") === "banner");
      if (!isFixed && !isSticky && !isBar) continue;
      // A full-screen overlay is a MODAL, not chrome: it is not furniture
      // standing at the edge of a page, it is a thing on top of the page.
      if (isFixed && cr.width >= vw * 0.9 && cr.height >= vh * 0.9) continue;
      if (isFixed) {
        if (cr.top <= 1) {
          topBands.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
        }
        if (cr.bottom >= vh - 1) {
          bottomBands.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
        }
        // A dialog is meant to be on top of the work: the reader opened it.
        var inDialog = ce.closest && ce.closest('[role="dialog"],[aria-modal="true"],dialog');
        if (!inDialog) coverers.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
        continue;
      }
      if (isSticky) {
        // A sticky element pins to the top when it reaches its own threshold.
        // It is chrome only while it is actually pinned there — a sticky
        // element still down the page is content, and it costs nothing.
        var stop = parseFloat(ccs.top);
        var sbot = parseFloat(ccs.bottom);
        var atTop = !isNaN(stop) && stop <= 2 && cr.top <= stop + 3;
        var atBottom = !isNaN(sbot) && cr.bottom >= vh - sbot - 3;
        if (atTop) {
          topBands.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
        }
        if (atBottom) {
          bottomBands.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
        }
        if (atTop || atBottom) coverers.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
        continue;
      }
      // An in-flow header at the top of the document is the page's own bar.
      if (cr.top <= 2) topBands.push({ sel: sel(ce), el: ce, a: cr.top, b: cr.bottom });
    }

    // The COMBINED footprint of the chrome: the height from the edge of the
    // viewport down to the lowest edge of any band standing there. Stacked
    // bands count together, because a reader loses the height of all of them.
    var topH = 0;
    var topSel = null;
    for (var tb = 0; tb < topBands.length; tb++) {
      if (topBands[tb].b > topH) {
        topH = topBands[tb].b;
        topSel = topBands[tb].sel;
      }
    }
    var botH = 0;
    var botSel = null;
    for (var bb = 0; bb < bottomBands.length; bb++) {
      var bandH = vh - bottomBands[bb].a;
      if (bandH > botH) {
        botH = bandH;
        botSel = bottomBands[bb].sel;
      }
    }

    // A fixed region that sits ON the work obscures it. The measurement is
    // the depth of the deepest work it covers, at the first screen, where a
    // reader arrives.
    function ownContent(e) {
      for (var n = 0; n < e.childNodes.length; n++) {
        if (e.childNodes[n].nodeType === 3 && e.childNodes[n].nodeValue.trim()) return true;
      }
      return /^(IMG|VIDEO|CANVAS|PICTURE)$/.test(e.tagName);
    }
    var worst = 0;
    var worstBand = null;
    var worstContent = null;
    for (var pi = 0; pi < coverers.length; pi++) {
      // Named pinBand, not band: `var band` is function-scoped to measure(),
      // so it hoisted over the outer band(items) helper and made every
      // `band(items)` call below throw. Fixed 2026-10-22.
      var pinBand = coverers[pi];
      for (var cj = 0; cj < all.length; cj++) {
        var cont = all[cj];
        if (pinBand.el.contains(cont) || cont.contains(pinBand.el)) continue;
        if (!ownContent(cont)) continue;
        var rr = cont.getBoundingClientRect();
        if (rr.bottom <= pinBand.a || rr.top >= pinBand.b) continue;
        var oTop = Math.max(pinBand.a, rr.top);
        var oBottom = Math.min(pinBand.b, rr.bottom);
        if (oBottom <= oTop) continue;
        // A region only OBSCURES the work if it is painted on top of it.
        // The browser knows which is on top and the browser is asked.
        //
        // WHERE it is asked matters. One sample at the content's left edge
        // plus 20px misses every band that does not reach that point: a bar
        // pinned to the RIGHT of the column covered the reading and the
        // gate called it clean. So the question is asked across the width
        // where the two actually meet, and the band is caught wherever it
        // is on top.
        var bandRect = pinBand.el.getBoundingClientRect();
        var ix0 = Math.max(rr.left, bandRect.left);
        var ix1 = Math.min(rr.right, bandRect.right);
        if (ix1 <= ix0) continue;
        var py = Math.round((oTop + oBottom) / 2);
        var span = ix1 - ix0;
        var samples = span > 120 ? 5 : 3;
        var onTopAnywhere = false;
        for (var si = 0; si < samples; si++) {
          var px = Math.round(ix0 + (span * (si + 0.5)) / samples);
          var onTop = null;
          try {
            onTop = d.elementFromPoint(px, py);
          } catch (e) {
            onTop = null;
          }
          if (!onTop) continue;
          if (onTop === pinBand.el || pinBand.el.contains(onTop)) {
            onTopAnywhere = true;
            break;
          }
        }
        if (!onTopAnywhere) continue;
        var oh = oBottom - oTop;
        if (oh > worst) {
          worst = oh;
          worstBand = pinBand;
          worstContent = cont;
        }
      }
    }
    if (worst > 0 && worstBand) {
      push(F, "overlap", worstBand.sel, worst,
        worstBand.sel + " covers " + Math.round(worst) + "px of " + sel(worstContent));
    }

    rec.chrome = {
      vh: vh,
      top: Math.round(topH),
      topPct: vh ? Math.round((topH / vh) * 1000) / 10 : null,
      bottom: Math.round(botH),
      bottomPct: vh ? Math.round((botH / vh) * 1000) / 10 : null,
      stacked: topBands.length,
      topSel: topSel,
      bottomSel: botSel,
    };

    // ---- 6. spatially expensive information --------------------------------
    // How far down the page the first thing you can DO is. A reader who must
    // scroll before they can act is paying for the layout.
    var acts = main.querySelectorAll("a, button, input, select, textarea");
    var firstY = null;
    var firstSel = null;
    for (var ai = 0; ai < acts.length; ai++) {
      var ae = acts[ai];
      if (!visible(ae, win)) continue;
      var ar = ae.getBoundingClientRect();
      var actable = /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) || loudControl(ae, win);
      if (!actable) continue;
      var y = ar.top + (win.scrollY || 0);
      if (firstY === null || y < firstY) {
        firstY = y;
        firstSel = sel(ae);
      }
    }
    rec.firstAction = { y: firstY === null ? null : Math.round(firstY), sel: firstSel };
    return rec;
  }

  window.__SPATIAL_MEASURE__ = measure;
  window.__SPATIAL_DEFAULTS__ = { DEAD: DEAD, SHORT: SHORT, EDGE: EDGE, CONTRAST: CONTRAST };
})();
