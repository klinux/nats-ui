import { describe, it, expect } from 'vitest';

import { lagLevel, lagLabel, lagDotClass, lagTextClass, lagBarPercent, lagStripeClass, LAG_WARN, LAG_CRIT } from './lag';

describe('lagLevel', () => {
  it('classifies the thresholds at their exact boundaries', () => {
    expect(lagLevel(0)).toBe('ok');
    expect(lagLevel(LAG_WARN - 1)).toBe('ok');
    expect(lagLevel(LAG_WARN)).toBe('warn');
    expect(lagLevel(LAG_CRIT - 1)).toBe('warn');
    expect(lagLevel(LAG_CRIT)).toBe('crit');
    expect(lagLevel(LAG_CRIT * 10)).toBe('crit');
  });

  it('treats missing or nonsensical values as healthy rather than critical', () => {
    expect(lagLevel(-1)).toBe('ok');
    expect(lagLevel(Number.NaN)).toBe('ok');
  });
});

describe('lagLabel', () => {
  it('names each level', () => {
    expect(lagLabel(0)).toBe('Healthy');
    expect(lagLabel(LAG_WARN)).toBe('Behind');
    expect(lagLabel(LAG_CRIT)).toBe('Critical');
  });
});

describe('lag classes', () => {
  it('maps every level onto a semantic token, never a palette colour', () => {
    for (const pending of [0, LAG_WARN, LAG_CRIT]) {
      expect(lagDotClass(pending)).toMatch(/^bg-state-(ok|warn|crit)$/);
      expect(lagTextClass(pending)).toMatch(/^text-state-(ok|warn|crit)$/);
    }
  });

  it('escalates with pending count', () => {
    expect(lagDotClass(0)).toBe('bg-state-ok');
    expect(lagDotClass(LAG_WARN)).toBe('bg-state-warn');
    expect(lagDotClass(LAG_CRIT)).toBe('bg-state-crit');
  });
});

describe('lagBarPercent', () => {
  it('is empty at zero and saturates well past critical', () => {
    expect(lagBarPercent(0)).toBe(0);
    expect(lagBarPercent(LAG_CRIT * 2)).toBe(100);
    expect(lagBarPercent(LAG_CRIT * 100)).toBe(100);
  });

  it('anchors each third of the bar to a threshold', () => {
    // The bar is readable against the thresholds rather than a raw ratio:
    // a third filled means "behind", two thirds means "critical".
    expect(lagBarPercent(LAG_WARN)).toBeCloseTo(33, 5);
    expect(lagBarPercent(LAG_CRIT)).toBeCloseTo(66, 5);
    expect(lagBarPercent(LAG_WARN / 2)).toBeCloseTo(16.5, 5);
  });

  it('never leaves the 0-100 range for nonsense input', () => {
    for (const value of [-500, Number.NaN, Number.POSITIVE_INFINITY]) {
      const pct = lagBarPercent(value);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

describe('class helpers are literal', () => {
  // Tailwind only generates classes it can find as literal text in the source.
  // Interpolated names compile to nothing, which is how the row stripe shipped
  // invisible; this pins the shape the scanner needs to see.
  it('returns the full class name for every level', () => {
    expect(lagStripeClass(0)).toBe('shadow-[inset_2px_0_0_var(--state-ok)]');
    expect(lagStripeClass(LAG_WARN)).toBe('shadow-[inset_2px_0_0_var(--state-warn)]');
    expect(lagStripeClass(LAG_CRIT)).toBe('shadow-[inset_2px_0_0_var(--state-crit)]');
    expect(lagTextClass(0)).toBe('text-state-ok');
    expect(lagDotClass(LAG_CRIT)).toBe('bg-state-crit');
  });
});
