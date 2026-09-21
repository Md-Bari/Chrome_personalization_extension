import { describe, it, expect, beforeEach } from 'vitest';
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
import { MaskRule } from '../src/shared/types';

describe('Storage Abstraction', () => {
  beforeEach(async () => {
    await clearMaskRules();
    await saveSettings({
      defaultMaskText: '****',
      revealDurationSeconds: 5,
      autoMaskEnabled: true,
      defaultMatchScope: 'domain',
      isPaused: false,
    });
  });

  it('saves and retrieves mask rules', async () => {
    const rule: MaskRule = {
      id: 'rule-1',
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
    expect(rules.length).toBe(1);
    expect(rules[0].id).toBe('rule-1');
  });

  it('filters rules by hostname and pathname scope', async () => {
    const ruleDomain: MaskRule = {
      id: 'rule-dom',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    const rulePage: MaskRule = {
      id: 'rule-page',
      hostname: 'example.com',
      pathname: '/settings',
      matchScope: 'page',
      mode: 'element',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    const ruleOther: MaskRule = {
      id: 'rule-other',
      hostname: 'other.org',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    await saveMaskRule(ruleDomain);
    await saveMaskRule(rulePage);
    await saveMaskRule(ruleOther);

    // Matching domain
    const siteRulesRoot = await getRulesForSite('example.com', '/');
    expect(siteRulesRoot.length).toBe(1);
    expect(siteRulesRoot[0].id).toBe('rule-dom');

    const siteRulesSettings = await getRulesForSite('example.com', '/settings');
    expect(siteRulesSettings.length).toBe(2);

    const otherRules = await getRulesForSite('other.org', '/');
    expect(otherRules.length).toBe(1);
    expect(otherRules[0].id).toBe('rule-other');
  });

  it('updates rule properties correctly', async () => {
    const rule: MaskRule = {
      id: 'rule-upd',
      hostname: 'test.com',
      matchScope: 'domain',
      mode: 'text',
      selector: { tagName: 'span', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };
    await saveMaskRule(rule);

    const updated = await updateMaskRule('rule-upd', { enabled: false, maskText: '████' });
    expect(updated).not.toBeNull();
    expect(updated?.enabled).toBe(false);
    expect(updated?.maskText).toBe('████');

    const rules = await getMaskRules();
    expect(rules[0].enabled).toBe(false);
  });

  it('deletes rules properly', async () => {
    const rule: MaskRule = {
      id: 'rule-del',
      hostname: 'test.com',
      matchScope: 'domain',
      mode: 'text',
      selector: { tagName: 'span', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };
    await saveMaskRule(rule);
    expect((await getMaskRules()).length).toBe(1);

    const deleted = await deleteMaskRule('rule-del');
    expect(deleted).toBe(true);
    expect((await getMaskRules()).length).toBe(0);
  });

  it('saves and retrieves global settings', async () => {
    const s1 = await getSettings();
    expect(s1.defaultMaskText).toBe('****');

    await saveSettings({ defaultMaskText: '••••', revealDurationSeconds: 10 });
    const s2 = await getSettings();
    expect(s2.defaultMaskText).toBe('••••');
    expect(s2.revealDurationSeconds).toBe(10);
  });
});
