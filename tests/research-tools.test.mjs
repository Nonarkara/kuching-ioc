import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const base = ['../public/', '../src/research/', '../'].map(p => new URL(p, import.meta.url)).find(p => existsSync(new URL('research-catalog.js', p)));
const { RESEARCH_COPY, RESEARCH_TASKS, RESEARCH_TOOLS, toolsFor, researchUrl, researchContext, researchRecord } = await import(new URL('research-catalog.js', base));
const { openResearchTools } = await import(new URL('research-tools.js', base));

test('manual catalog is localized, relevant and never counted as a connected feed', () => {
  assert.equal(toolsFor('padawan').length, 6);
  for (const system of ['globalmonitor', 'asiawatch', 'mem']) assert.equal(toolsFor(system).length, 8);
  assert.equal(toolsFor('unknown').length, 0);
  for (const tool of RESEARCH_TOOLS) {
    assert.equal(tool.feedStatus, 'not-connected'); assert.equal(tool.lastChecked, null);
    assert.equal(tool.accessMode, 'manual-link'); assert.equal(researchUrl(tool.url), tool.url);
    for (const lang of ['en', 'ms', 'zh', 'th']) assert.ok(tool.limit[lang]?.trim());
  }
  for (const field of [...Object.values(RESEARCH_COPY), ...Object.values(RESEARCH_TASKS)]) for (const lang of ['en', 'ms', 'zh', 'th']) assert.ok(field[lang]?.trim());
});

test('outbound allowlist rejects injected, credentialed and query-bearing destinations', () => {
  for (const url of ['javascript:alert(1)', 'https://www.openstreetmap.org/?q=private-report', 'https://www.openstreetmap.org.evil.test/', 'https://user:secret@www.openstreetmap.org/', '//www.openstreetmap.org/', 'https://example.org/']) assert.equal(researchUrl(url), null);
});

test('event dates and Date-valued times retain their meaning through the exported record', () => {
  const context = researchContext({ label: 'Event', eventAt: '2026-10-23', publishedAt: new Date('2026-10-25T01:00:00Z'), observedAt: new Date('invalid') });
  const record = researchRecord('mem', context);
  assert.equal(record.context.eventAt, '2026-10-23');
  assert.equal(record.context.publishedAt, '2026-10-25T01:00:00.000Z');
  assert.equal(record.context.observedAt, null);
});

test('research records retain supplied times separately without forwarding coordinates or arbitrary fields', () => {
  const raw = { label: 'Public report', observedAt: '2026-10-23T10:00:00Z', publishedAt: '2026-10-24T01:00:00Z', lat: 1.23456, secret: 'do not export' };
  const record = researchRecord('padawan', raw, '2026-10-25T02:00:00Z');
  assert.equal(record.context.observedAt, raw.observedAt); assert.equal(record.context.publishedAt, raw.publishedAt);
  assert.equal(record.recordedAt, '2026-10-25T02:00:00Z');
  assert.equal(JSON.stringify(record).includes('do not export'), false);
  assert.equal(JSON.stringify(record).includes('1.23456'), false);
  assert.equal(researchContext({ label: '  ' }), null);
  assert.equal(researchContext({ label: 'x'.repeat(1000) }).label.length, 240);
});

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.attributes = {}; this.isConnected = true; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  replaceChildren() { this._text = ''; this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  async emit(name, extra = {}) { for (const fn of this.listeners[name] || []) await fn({ target: this, ...extra }); }
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelector(selector) {
    if (selector === 'header button') return this.all().find(e => e.tagName === 'header')?.all().find(e => e.tagName === 'button');
    if (selector === 'dialog.research-tools[open]') return this.all().find(e => e.tagName === 'dialog' && e.open);
    return this.all().find(e => e.tagName === selector);
  }
  focus() { globalThis.document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; return this.emit('close'); }
  remove() { this.isConnected = false; this.parent.children = this.parent.children.filter(c => c !== this); }
}

test('real dialog builder renders text safely, supports tasks/languages and preserves the host context on Escape', async () => {
  const oldDoc = globalThis.document, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const body = new Element('body'), opener = new Element('button');
  let copied = '';
  globalThis.document = { body, activeElement: opener, createElement: tag => new Element(tag), querySelector: s => body.querySelector(s) };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { copied = text; } } } });
  try {
    const dialog = openResearchTools({ system: 'padawan', context: { label: '<img src=x onerror=alert(1)>' } });
    assert.ok(dialog.open); assert.ok(dialog.textContent.includes('<img src=x onerror=alert(1)>'));
    assert.equal(dialog.all().some(e => ['img', 'script', 'iframe'].includes(e.tagName)), false);
    assert.equal(openResearchTools(), undefined, 'double click does not create a second modal');
    let stopped = false; await dialog.emit('keydown', { key: 'Escape', stopPropagation() { stopped = true; } });
    assert.ok(stopped, 'host document shortcuts must not also process Escape');
    let selects = dialog.all().filter(e => e.tagName === 'select');
    selects[1].value = 'imagery'; await selects[1].emit('change');
    assert.ok(dialog.textContent.includes('NASA Worldview')); assert.equal(dialog.textContent.includes('Mapillary'), false);
    selects = dialog.all().filter(e => e.tagName === 'select');
    selects[0].value = 'zh'; await selects[0].emit('change');
    assert.equal(dialog.lang, 'zh-Hans'); assert.ok(dialog.textContent.includes('核查证据与来源'));
    const copy = dialog.all().find(e => e.tagName === 'button' && e.textContent === '复制研究背景');
    await copy.emit('click'); assert.equal(JSON.parse(copied).context.label, '<img src=x onerror=alert(1)>');
    for (const anchor of dialog.all().filter(e => e.tagName === 'a')) { assert.equal(anchor.rel, 'noopener noreferrer'); assert.equal(anchor.referrerPolicy, 'no-referrer'); assert.ok(researchUrl(anchor.href)); }
    await dialog.close(); assert.equal(body.children.length, 0); assert.equal(globalThis.document.activeElement, opener);
    const empty = openResearchTools({ system: 'mem' });
    assert.ok(empty.textContent.includes('No place or event selected'));
    assert.equal(empty.dataset.system, 'mem');
    delete globalThis.navigator.clipboard;
    await empty.all().find(e => e.tagName === 'button' && e.textContent === 'Copy research context').emit('click');
    assert.ok(empty.textContent.includes('Clipboard unavailable'));
    await empty.close();
  } finally {
    globalThis.document = oldDoc;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});
