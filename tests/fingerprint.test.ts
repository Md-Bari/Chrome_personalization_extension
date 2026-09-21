import { describe, it, expect } from 'vitest';
import { normalizeText, createTextFingerprint } from '../src/content/fingerprint';

describe('Text Fingerprinting', () => {
  it('normalizes text by trimming, collapsing spaces, and lowercasing', () => {
    expect(normalizeText('   Hello    World   ')).toBe('hello world');
    expect(normalizeText('Salary:\t\n$85,000')).toBe('salary: $85,000');
    expect(normalizeText('')).toBe('');
  });

  it('produces identical fingerprints for texts differing only in whitespace and casing', async () => {
    const fp1 = await createTextFingerprint('  $85,000  ');
    const fp2 = await createTextFingerprint('$85,000');
    const fp3 = await createTextFingerprint('\n$85,000\t');

    expect(fp1).toBe(fp2);
    expect(fp2).toBe(fp3);
    expect(fp1.length).toBeGreaterThan(0);
  });

  it('produces different fingerprints for different sensitive texts', async () => {
    const fp1 = await createTextFingerprint('$85,000');
    const fp2 = await createTextFingerprint('$95,000');
    const fp3 = await createTextFingerprint('john.doe@example.com');

    expect(fp1).not.toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp2).not.toBe(fp3);
  });

  it('handles empty or null string gracefully', async () => {
    const fp = await createTextFingerprint('');
    expect(fp).toBe('');
  });
});
