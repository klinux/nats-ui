/**
 * Small time series helpers for the dashboard's throughput readout.
 *
 * The server reports cumulative counters, so a rate has to be derived from
 * consecutive polls. Keeping that arithmetic here means it can be tested
 * against the awkward cases — a restarted server resetting its counters, two
 * samples landing in the same millisecond — instead of inside a component.
 */
export interface Sample {
  /** Epoch milliseconds. */
  t: number;
  /** Cumulative counter value at that moment. */
  value: number;
}

/** Appends a sample, dropping the oldest beyond `max`. Returns a new array. */
export function pushSample(series: Sample[], sample: Sample, max: number): Sample[] {
  const last = series[series.length - 1];
  // Out-of-order or duplicate polls would produce a bogus window.
  if (last && sample.t <= last.t) return series;

  const next = [...series, sample];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Average per-second change across the whole window. */
export function ratePerSecond(series: Sample[]): number {
  if (series.length < 2) return 0;

  const first = series[0];
  const last = series[series.length - 1];
  const seconds = (last.t - first.t) / 1000;
  if (seconds <= 0) return 0;

  const delta = last.value - first.value;
  // A counter that went backwards means the server restarted, not negative
  // throughput.
  return delta < 0 ? 0 : delta / seconds;
}

/**
 * Per-interval rates between consecutive samples — what the sparkline plots.
 * The window-wide `ratePerSecond` smooths away exactly the spikes an operator
 * is looking for.
 */
export function rates(series: Sample[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    out.push(ratePerSecond([series[i - 1], series[i]]));
  }
  return out;
}

/** SVG path for a sparkline spanning the given box. */
export function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = width / (values.length - 1);

  return values
    .map((value, i) => {
      const x = round(i * stepX);
      // A flat series has no range to scale into; centre it.
      const y = round(span === 0 ? height / 2 : height - ((value - min) / span) * height);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
