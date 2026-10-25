import { CATALOG_VERSION, RESEARCH_TASKS, researchText, researchUrl, researchContext, researchRecord, toolsFor } from './research-catalog.js';

// A native modal is created only on request. No fetches, frames, geolocation,
// storage or external scripts; the catalog is separate from feed health.
export function openResearchTools({ system = 'padawan', lang = 'en', context = null, returnFocus = null } = {}) {
  if (document.querySelector('dialog.research-tools[open]')) return;
  const languages = system === 'padawan' ? ['en', 'ms', 'zh'] : ['en', 'th', 'zh'];
  let language = languages.includes(lang) ? lang : 'en';
  const selected = researchContext(context);
  const opener = returnFocus || document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'research-tools';
  dialog.dataset.system = system;
  dialog.dataset.catalogVersion = CATALOG_VERSION;
  dialog.setAttribute('aria-labelledby', 'research-tools-title');
  let task = 'place';
  const node = (tag, text, parent = dialog) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    parent.appendChild(el);
    return el;
  };
  const link = (name, url, parent) => {
    const safe = researchUrl(url);
    if (!safe) return null;
    const a = node('a', name, parent);
    a.href = safe; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
    return a;
  };
  function render(focusTask = false) {
    dialog.replaceChildren();
    dialog.lang = language === 'zh' ? 'zh-Hans' : language;
    const t = key => researchText(key, language);
    const header = node('header');
    node('h2', t('title'), header).id = 'research-tools-title';
    const close = node('button', t('close'), header);
    close.type = 'button'; close.addEventListener('click', () => dialog.close());
    const body = node('div'); body.className = 'research-tools-body';
    const controls = node('div', null, body); controls.className = 'research-tools-controls';
    const langLabel = node('label', t('language'), controls);
    const langSelect = node('select', null, langLabel);
    for (const code of languages) { const o = node('option', ({en:'English', ms:'Bahasa Malaysia', zh:'中文', th:'ไทย'})[code], langSelect); o.value = code; }
    langSelect.value = language;
    langSelect.addEventListener('change', () => { language = langSelect.value; render(); dialog.querySelector('select').focus(); });
    if (selected) {
      const p = node('p', null, body); p.className = 'research-tools-context';
      node('span', t('context') + ': ', p); node('strong', selected.label, p);
      for (const [field, label] of [['observedAt', 'observed'], ['publishedAt', 'published'], ['eventAt', 'event']]) if (selected[field]) node('p', t(label) + ': ' + selected[field], body);
      node('p', t('locationLimit'), body);
    } else node('p', t('noContext'), body);
    node('p', t('manual'), body);
    const taskLabel = node('label', t('task'), body); taskLabel.className = 'research-tools-task';
    const select = node('select', null, taskLabel);
    for (const key of Object.keys(RESEARCH_TASKS)) {
      if (!toolsFor(system, key).length) continue;
      const option = node('option', RESEARCH_TASKS[key][language], select); option.value = key;
    }
    select.value = task;
    select.addEventListener('change', () => { task = select.value; render(true); });
    const list = node('ul', null, body); list.className = 'research-tools-list';
    for (const tool of toolsFor(system, task)) {
      const li = node('li', null, list);
      node('h3', tool.name, li);
      node('p', tool.limit[language], li);
      link(t('website') + ' · ' + tool.name + ' ↗', tool.url, li);
      const details = node('details', null, li);
      node('summary', t('details'), details);
      for (const [name, text] of [['provider', tool.provider], ['coverage', t('worldwide')], ['access', t('terms')], ['checked', t('unverified')]]) {
        node('p', t(name) + ': ' + text, details);
      }
    }
    const method = node('details', null, body);
    node('summary', t('method'), method); node('p', t('funnel'), method); node('p', t('caution'), method);
    const footer = node('footer', null, body);
    const copy = node('button', t('record'), footer); copy.type = 'button';
    const notice = node('span', '', footer); notice.setAttribute('role', 'status');
    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(JSON.stringify(researchRecord(system, selected), null, 2));
        notice.textContent = t('copied');
      } catch { notice.textContent = t('copyFailed'); }
    });
    const credits = node('details', null, body);
    node('summary', 'SIC · ' + ({en:'Sources and credits', ms:'Sumber dan kredit', zh:'来源与致谢', th:'แหล่งข้อมูลและเครดิต'})[language], credits);
    node('p', t('credit'), credits);
    link('OSINT4ALL · CC0', 'https://github.com/osint4all/osint4all.github.io', credits);
    node('span', ' · ', credits); link('Bellingcat Toolkit', 'https://bellingcat.gitbook.io/toolkit', credits);
    if (focusTask) select.focus();
  }
  // Native Escape still closes this dialog, but must not also close a host
  // drawer or clear its selected map feature through a global shortcut.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => { dialog.remove(); if (opener?.isConnected) opener.focus(); }, { once: true });
  document.body.appendChild(dialog);
  render();
  dialog.showModal();
  // Start at a useful, labelled action; native dialog supplies focus trapping
  // and Escape. Do not install a document-level Escape handler of our own.
  dialog.querySelector('header button').focus();
  return dialog;
}
