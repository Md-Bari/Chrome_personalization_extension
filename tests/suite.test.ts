import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://example.com/',
});
global.window = dom.window as any;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Text = dom.window.Text;
global.NodeFilter = dom.window.NodeFilter;
global.CSS = (dom.window as any).CSS || {
  escape: (str: string) => str.replace(/([^\w-])/g, '\\$1'),
};

import { normalizeText, createTextFingerprint } from '../src/content/fingerprint';
import {
  isLikelyStableClass,
  isStableId,
  getStableAttributes,
  generateSelector,
  findElementBySelectorInfo,
} from '../src/content/selector';
import {
  getMaskRules,
  saveMaskRule,
  updateMaskRule,
  deleteMaskRule,
  clearMaskRules,
  getRulesForSite,
  getSettings,
  saveSettings,
} from '../src/shared/storage';
import {
  applyMaskRule,
  removeMaskRule,
  isElementMasked,
  removeAllMasks,
  temporarilyRevealRule,
} from '../src/content/masking';
import { OVERLAY_ATTR, WRAPPER_ATTR } from '../src/shared/constants';
import { MaskRule } from '../src/shared/types';

describe('Text Fingerprinting', () => {
  test('normalizes text by trimming and collapsing whitespace', () => {
    assert.strictEqual(normalizeText('   Hello    World   '), 'hello world');
    assert.strictEqual(normalizeText('Salary:\t\n$85,000'), 'salary: $85,000');
    assert.strictEqual(normalizeText(''), '');
  });

  test('produces identical fingerprints for same text', async () => {
    const fp1 = await createTextFingerprint('  $85,000  ');
    const fp2 = await createTextFingerprint('$85,000');
    assert.strictEqual(fp1, fp2);
    assert.ok(fp1.length > 0);
  });

  test('produces distinct fingerprints for different texts', async () => {
    const fp1 = await createTextFingerprint('$85,000');
    const fp2 = await createTextFingerprint('$95,000');
    assert.notStrictEqual(fp1, fp2);
  });
});

describe('Selector Generation & Stability', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('isLikelyStableClass filters dynamic hashes and keeps semantic classes', () => {
    assert.strictEqual(isLikelyStableClass('css-1a2b3c'), false);
    assert.strictEqual(isLikelyStableClass('sc-bdfBwQ'), false);
    assert.strictEqual(isLikelyStableClass('_abc123'), false);
    assert.strictEqual(isLikelyStableClass('salary-card'), true);
    assert.strictEqual(isLikelyStableClass('account-balance'), true);
  });

  test('isStableId rejects generated ids', () => {
    assert.strictEqual(isStableId(':r1:'), false);
    assert.strictEqual(isStableId('ember12345'), false);
    assert.strictEqual(isStableId('user-salary'), true);
  });

  test('getStableAttributes collects data-testid', () => {
    const div = document.createElement('div');
    div.setAttribute('data-testid', 'test-phone');
    const attrs = getStableAttributes(div);
    assert.strictEqual(attrs['data-testid'], 'test-phone');
  });

  test('generates selector with ID and resolves correctly', async () => {
    const span = document.createElement('span');
    span.id = 'salary';
    span.textContent = '$85,000';
    document.body.appendChild(span);

    const info = await generateSelector(span);
    assert.strictEqual(info.id, 'salary');

    const found = findElementBySelectorInfo(info, document);
    assert.strictEqual(found, span);
  });

  test('generates selector with data-testid and resolves correctly', async () => {
    const span = document.createElement('span');
    span.setAttribute('data-testid', 'emp-badge');
    span.textContent = 'EMP-900';
    document.body.appendChild(span);

    const info = await generateSelector(span);
    assert.strictEqual(info.cssSelector, '[data-testid="emp-badge"]');

    const found = findElementBySelectorInfo(info, document);
    assert.strictEqual(found, span);
  });
});

describe('Storage Operations', () => {
  beforeEach(async () => {
    await clearMaskRules();
  });

  test('saves and retrieves mask rules', async () => {
    const rule: MaskRule = {
      id: 'r1',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'span', id: 'salary', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    await saveMaskRule(rule);
    const rules = await getMaskRules();
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].id, 'r1');
  });

  test('filters rules by domain and page scope', async () => {
    const r1: MaskRule = {
      id: 'r1',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };
    const r2: MaskRule = {
      id: 'r2',
      hostname: 'example.com',
      pathname: '/profile',
      matchScope: 'page',
      mode: 'element',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };
    await saveMaskRule(r1);
    await saveMaskRule(r2);

    const matchDomain = await getRulesForSite('example.com', '/');
    assert.strictEqual(matchDomain.length, 1);

    const matchPage = await getRulesForSite('example.com', '/profile');
    assert.strictEqual(matchPage.length, 2);
  });

  test('updates and deletes rules', async () => {
    const r1: MaskRule = {
      id: 'r-del',
      hostname: 'test.com',
      matchScope: 'domain',
      mode: 'text',
      selector: { tagName: 'span', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };
    await saveMaskRule(r1);
    await updateMaskRule('r-del', { maskText: '████' });
    let rules = await getMaskRules();
    assert.strictEqual(rules[0].maskText, '████');

    await deleteMaskRule('r-del');
    rules = await getMaskRules();
    assert.strictEqual(rules.length, 0);
  });

  test('manages settings', async () => {
    await saveSettings({ defaultMaskText: '••••', revealDurationSeconds: 10 });
    const s = await getSettings();
    assert.strictEqual(s.defaultMaskText, '••••');
    assert.strictEqual(s.revealDurationSeconds, 10);
  });
});

describe('Masking Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('masks and unmasks text nodes safely', () => {
    const p = document.createElement('p');
    p.innerHTML = 'Salary: <span id="val">$85,000</span>';
    document.body.appendChild(p);

    const targetSpan = document.getElementById('val')!;
    const rule: MaskRule = {
      id: 'r-text',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'text',
      selector: { tagName: 'span', id: 'val', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    applyMaskRule(targetSpan, rule);
    assert.ok(targetSpan.querySelector(`[${WRAPPER_ATTR}="r-text"]`));
    assert.strictEqual(isElementMasked(targetSpan), true);

    removeMaskRule('r-text', document);
    assert.strictEqual(targetSpan.textContent, '$85,000');
  });

  test('creates element overlay and prevents duplicate overlays', () => {
    const card = document.createElement('div');
    card.id = 'balance';
    card.textContent = '$5,000.00';
    document.body.appendChild(card);

    const rule: MaskRule = {
      id: 'r-elem',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'div', id: 'balance', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    applyMaskRule(card, rule);
    applyMaskRule(card, rule); // Idempotent check

    const overlays = document.querySelectorAll(`[${OVERLAY_ATTR}="r-elem"]`);
    assert.strictEqual(overlays.length, 1);

    removeMaskRule('r-elem', document);
    assert.strictEqual(document.querySelectorAll(`[${OVERLAY_ATTR}="r-elem"]`).length, 0);
  });

  test('temporarily reveals masked text and cleans up with removeAllMasks', () => {
    const span = document.createElement('span');
    span.textContent = 'Secret Value';
    document.body.appendChild(span);

    const rule: MaskRule = {
      id: 'r-rev',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'text',
      selector: { tagName: 'span', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    applyMaskRule(span, rule);
    temporarilyRevealRule(rule, 1, document);

    const maskSpan = span.querySelector('.privacy-mask-masked-text');
    assert.strictEqual(maskSpan?.textContent, 'Secret Value');

    removeAllMasks(document);
    assert.strictEqual(document.querySelectorAll(`[${WRAPPER_ATTR}]`).length, 0);
  });
});
