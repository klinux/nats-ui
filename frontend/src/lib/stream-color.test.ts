import { describe, it, expect } from 'vitest';

import { streamHue, streamColor, STATE_HUES } from './stream-color';

describe('streamHue', () => {
  it('is stable for a given name', () => {
    expect(streamHue('ORDERS')).toBe(streamHue('ORDERS'));
  });

  it('separates names that differ', () => {
    expect(streamHue('ORDERS')).not.toBe(streamHue('PAYMENTS'));
  });

  it('never lands on a hue reserved for state', () => {
    const names = ['ORDERS', 'PAYMENTS', 'AUDIT', 'SESSIONS', 'events', 'a', '', 'Ω-stream'];
    for (const name of names) {
      const hue = streamHue(name);
      for (const reserved of STATE_HUES) {
        // Reserved hues carry meaning; an identity colour must not imitate them.
        expect(Math.abs(hue - reserved)).toBeGreaterThan(15);
      }
    }
  });

  it('handles non-ASCII names without collapsing them together', () => {
    expect(streamHue('pedidos')).not.toBe(streamHue('pedidos-ção'));
  });
});

describe('streamColor', () => {
  it('holds lightness and chroma constant so no stream outshouts another', () => {
    for (const name of ['ORDERS', 'PAYMENTS', 'AUDIT']) {
      expect(streamColor(name)).toMatch(/^oklch\(0\.72 0\.15 \d+(\.\d+)?\)$/);
    }
  });
});
