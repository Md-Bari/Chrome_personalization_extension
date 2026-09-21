import { describe, it, expect, beforeEach } from 'vitest';
import {
  isLikelyStableClass,
  isStableId,
  getStableAttributes,
  generateSelector,
  findElementBySelectorInfo,
} from '../src/content/selector';

describe('Selector Generation & Dynamic Class Detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('isLikelyStableClass', () => {
    it('detects and rejects unstable dynamic classes', () => {
      expect(isLikelyStableClass('css-1a2b3c')).toBe(false);
      expect(isLikelyStableClass('sc-bdfBwQ')).toBe(false);
      expect(isLikelyStableClass('hash-83hd92')).toBe(false);
      expect(isLikelyStableClass('_abc123')).toBe(false);
      expect(isLikelyStableClass('jsx-123456')).toBe(false);
      expect(isLikelyStableClass('svelte-abc123')).toBe(false);
      expect(isLikelyStableClass('privacy-mask-hover')).toBe(false);
      expect(isLikelyStableClass('394827')).toBe(false);
    });

    it('accepts stable semantic CSS classes', () => {
      expect(isLikelyStableClass('salary-card')).toBe(true);
      expect(isLikelyStableClass('user-profile-header')).toBe(true);
      expect(isLikelyStableClass('account-balance')).toBe(true);
      expect(isLikelyStableClass('email-address')).toBe(true);
      expect(isLikelyStableClass('price-tag')).toBe(true);
    });
  });

  describe('isStableId', () => {
    it('rejects dynamic react/generated IDs', () => {
      expect(isStableId(':r1:')).toBe(false);
      expect(isStableId('ember12345')).toBe(false);
      expect(isStableId('react-aria-987654')).toBe(false);
    });

    it('accepts meaningful semantic IDs', () => {
      expect(isStableId('user-salary')).toBe(true);
      expect(isStableId('bank-balance')).toBe(true);
      expect(isStableId('email-display')).toBe(true);
    });
  });

  describe('getStableAttributes', () => {
    it('extracts data-testid, data-test, data-qa, aria-label, and name', () => {
      const div = document.createElement('div');
      div.setAttribute('data-testid', 'balance-amount');
      div.setAttribute('data-random-123984', 'unstable');
      div.setAttribute('aria-label', 'User balance');

      const attrs = getStableAttributes(div);
      expect(attrs['data-testid']).toBe('balance-amount');
      expect(attrs['aria-label']).toBe('User balance');
      expect(attrs['data-random-123984']).toBeUndefined();
    });
  });

  describe('generateSelector and findElementBySelectorInfo', () => {
    it('generates a stable ID selector when available', async () => {
      const span = document.createElement('span');
      span.id = 'salary-amount';
      span.textContent = '$85,000';
      document.body.appendChild(span);

      const info = await generateSelector(span);
      expect(info.id).toBe('salary-amount');
      expect(info.cssSelector).toBe('#salary-amount');

      const found = findElementBySelectorInfo(info, document);
      expect(found).toBe(span);
    });

    it('generates a data-testid selector when ID is absent', async () => {
      const span = document.createElement('span');
      span.setAttribute('data-testid', 'employee-id-field');
      span.textContent = 'EMP-9921';
      document.body.appendChild(span);

      const info = await generateSelector(span);
      expect(info.cssSelector).toBe('[data-testid="employee-id-field"]');

      const found = findElementBySelectorInfo(info, document);
      expect(found).toBe(span);
    });

    it('generates a hierarchical path selector when no unique classes exist', async () => {
      document.body.innerHTML = `
        <div class="container">
          <ul>
            <li><span>Item 1</span></li>
            <li><span class="css-dyn123">Secret Value</span></li>
          </ul>
        </div>
      `;

      const target = document.querySelectorAll('li')[1].querySelector('span')!;
      const info = await generateSelector(target);

      const found = findElementBySelectorInfo(info, document);
      expect(found).toBe(target);
    });

    it('falls back to finding element if class name changes but structure/tag matches', async () => {
      document.body.innerHTML = `
        <div class="user-card">
          <span class="old-class">$50,000</span>
        </div>
      `;

      const originalSpan = document.querySelector('span')!;
      const info = await generateSelector(originalSpan);

      // Simulate website changing class tomorrow
      originalSpan.className = 'new-revamped-class';

      const found = findElementBySelectorInfo(info, document);
      expect(found).toBe(originalSpan);
    });
  });
});
