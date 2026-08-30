/**
 * Stable identity colour per stream.
 *
 * A stream keeps the same hue everywhere it appears, so you learn to recognise
 * PAYMENTS by colour and stop reading names. Derived from the name so it needs
 * no stored configuration, and held at fixed lightness and chroma so no stream
 * ever visually outranks another.
 */

/** Hues that carry meaning and must never be handed to a stream. */
export const STATE_HUES = [22, 82, 168] as const;

/** Identity hues live in a band that avoids the state hues entirely. */
const HUE_START = 200;
const HUE_RANGE = 140;

export function streamHue(name: string): number {
  let hash = 0;
  // Iterating code points keeps non-ASCII names distinct.
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
  }
  return HUE_START + (Math.abs(hash) % HUE_RANGE);
}

export function streamColor(name: string): string {
  return `oklch(0.72 0.15 ${streamHue(name)})`;
}
