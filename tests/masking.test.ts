import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applyMaskRule,
  removeMaskRule,
  temporarilyRevealRule,
  isElementMasked,
  removeAllMasks,
} from '../src/content/masking';
import { MaskRule } from '../src/shared/types';
import { OVERLAY_ATTR, WRAPPER_ATTR } from '../src/shared/constants';

describe('Masking Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  it('safely masks text inside an element without destroying DOM structure', () => {
    const p = document.createElement('p');
    p.innerHTML = 'Monthly Salary: <span id="val">$85,000</span>';
    document.body.appendChild(p);

    const targetSpan = document.getElementById('val')!;
    const rule: MaskRule = {
      id: 'rule-text-1',
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

    const wrapper = targetSpan.querySelector(`[${WRAPPER_ATTR}="rule-text-1"]`);
    expect(wrapper).not.toBeNull();
    expect(wrapper?.textContent).toContain('****');
    expect(isElementMasked(targetSpan)).toBe(true);

    // Unmask
    removeMaskRule('rule-text-1', document);
    expect(targetSpan.textContent).toBe('$85,000');
  });

  it('creates an element visual overlay for element mode', () => {
    const card = document.createElement('div');
    card.id = 'salary-card';
    card.textContent = 'Confidential details here';
    document.body.appendChild(card);

    const rule: MaskRule = {
      id: 'rule-elem-1',
      hostname: 'example.com',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'div', id: 'salary-card', attributes: {} },
      maskText: '****',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    };

    applyMaskRule(card, rule);

    const overlay = document.querySelector(`[${OVERLAY_ATTR}="rule-elem-1"]`);
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('****');
    expect(card.getAttribute(OVERLAY_ATTR)).toBe('rule-elem-1');

    // Clean removal
    removeMaskRule('rule-elem-1', document);
    expect(document.querySelector(`[${OVERLAY_ATTR}="rule-elem-1"]`)).toBeNull();
    expect(card.hasAttribute(OVERLAY_ATTR)).toBe(false);
  });

  it('prevents duplicate overlays when applied multiple times (idempotent)', () => {
    const card = document.createElement('div');
    card.id = 'balance';
    card.textContent = '$5,000.00';
    document.body.appendChild(card);

    const rule: MaskRule = {
      id: 'rule-idem',
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
    applyMaskRule(card, rule);
    applyMaskRule(card, rule);

    const overlays = document.querySelectorAll(`[${OVERLAY_ATTR}="rule-idem"]`);
    expect(overlays.length).toBe(1);
  });

  it('temporarily reveals text and automatically re-masks after duration', () => {
    const span = document.createElement('span');
    span.textContent = 'Secret 1234';
    document.body.appendChild(span);

    const rule: MaskRule = {
      id: 'rule-reveal',
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

    // Trigger reveal for 5 seconds
    temporarilyRevealRule(rule, 5, document);

    const maskSpan = span.querySelector('.privacy-mask-masked-text');
    expect(maskSpan?.textContent).toBe('Secret 1234');

    // Advance timer by 5.1 seconds
    vi.advanceTimersByTime(5100);

    expect(maskSpan?.textContent).toBe('****');
  });

  it('cleans up all masks with removeAllMasks', () => {
    const el1 = document.createElement('div');
    el1.textContent = 'Value 1';
    const el2 = document.createElement('div');
    el2.textContent = 'Value 2';
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    applyMaskRule(el1, {
      id: 'r1',
      hostname: 'x.com',
      matchScope: 'domain',
      mode: 'element',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: 0,
      updatedAt: 0,
      enabled: true,
    });

    applyMaskRule(el2, {
      id: 'r2',
      hostname: 'x.com',
      matchScope: 'domain',
      mode: 'text',
      selector: { tagName: 'div', attributes: {} },
      maskText: '****',
      createdAt: 0,
      updatedAt: 0,
      enabled: true,
    });

    removeAllMasks(document);
    expect(document.querySelectorAll(`[${OVERLAY_ATTR}]`).length).toBe(0);
    expect(document.querySelectorAll(`[${WRAPPER_ATTR}]`).length).toBe(0);
  });
});
