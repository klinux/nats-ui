import { describe, it, expect } from 'vitest';

import { pushSample, rates, ratePerSecond, sparklinePath, type Sample } from './series';

const at = (t: number, value: number): Sample => ({ t, value });

describe('pushSample', () => {
  it('appends and caps the series without mutating the input', () => {
    const series = [at(0, 1), at(1000, 2)];
    const next = pushSample(series, at(2000, 3), 2);

    expect(series).toHaveLength(2);
    expect(next).toHaveLength(2);
    expect(next[next.length - 1]).toEqual(at(2000, 3));
    expect(next[0]).toEqual(at(1000, 2));
  });

  it('ignores a sample that is not newer than the last', () => {
    const series = [at(1000, 5)];
    expect(pushSample(series, at(1000, 9), 10)).toBe(series);
    expect(pushSample(series, at(500, 9), 10)).toBe(series);
  });
});

describe('ratePerSecond', () => {
  it('derives a per-second rate across the window', () => {
    expect(ratePerSecond([at(0, 0), at(10_000, 500)])).toBe(50);
  });

  it('needs two samples', () => {
    expect(ratePerSecond([])).toBe(0);
    expect(ratePerSecond([at(0, 10)])).toBe(0);
  });

  // Counters reset when the NATS server restarts; a negative rate is nonsense.
  it('reports zero when the counter goes backwards', () => {
    expect(ratePerSecond([at(0, 900), at(1000, 12)])).toBe(0);
  });

  it('does not divide by a zero window', () => {
    expect(ratePerSecond([at(1000, 1), at(1000, 2)])).toBe(0);
  });
});

describe('sparklinePath', () => {
  it('spans the full box and tracks the values', () => {
    const path = sparklinePath([0, 5, 10], 100, 20);
    expect(path).toMatch(/^M0,20 L50,10 L100,0$/);
  });

  it('draws a flat mid-line when every value is identical', () => {
    expect(sparklinePath([7, 7, 7], 100, 20)).toBe('M0,10 L50,10 L100,10');
  });

  it('returns nothing to draw for fewer than two points', () => {
    expect(sparklinePath([], 100, 20)).toBe('');
    expect(sparklinePath([3], 100, 20)).toBe('');
  });
});

describe('rates', () => {
  it('produces one rate per interval', () => {
    expect(rates([at(0, 0), at(1000, 10), at(2000, 40)])).toEqual([10, 30]);
  });

  it('has nothing to report with fewer than two samples', () => {
    expect(rates([])).toEqual([]);
    expect(rates([at(0, 5)])).toEqual([]);
  });

  it('flattens a counter reset to zero rather than a negative spike', () => {
    expect(rates([at(0, 900), at(1000, 5), at(2000, 15)])).toEqual([0, 10]);
  });
});
