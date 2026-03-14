import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  parseUptimeToSeconds,
  formatUptimeFromSeconds,
  formatUptime,
} from './format';

describe('formatBytes', () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns "0 B" for negative values', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });

  it('returns "0 B" for NaN', () => {
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('returns "0 B" for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('0 B');
  });

  it('formats values under 1024 as bytes', () => {
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats exactly 1024 as 1 KB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats 1048576 as 1 MB', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats large values as GB', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('formats very large values as TB', () => {
    expect(formatBytes(1099511627776)).toBe('1 TB');
  });

  it('formats fractional KB correctly', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('parseUptimeToSeconds', () => {
  it('returns 0 for null', () => {
    expect(parseUptimeToSeconds(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseUptimeToSeconds(undefined)).toBe(0);
  });

  it('returns 0 for 0', () => {
    expect(parseUptimeToSeconds(0)).toBe(0);
  });

  it('parses "5s" correctly', () => {
    expect(parseUptimeToSeconds('5s')).toBe(5);
  });

  it('parses "3m10s" correctly', () => {
    expect(parseUptimeToSeconds('3m10s')).toBe(190);
  });

  it('parses "2h5m" correctly', () => {
    expect(parseUptimeToSeconds('2h5m')).toBe(7500);
  });

  it('parses "1d3h5m10s" correctly', () => {
    expect(parseUptimeToSeconds('1d3h5m10s')).toBe(97510);
  });

  it('converts numeric input by stringifying it', () => {
    // A plain number like 42 becomes "42" which has no d/h/m/s suffixes
    expect(parseUptimeToSeconds(42)).toBe(0);
  });
});

describe('formatUptimeFromSeconds', () => {
  it('returns "0s" for 0', () => {
    expect(formatUptimeFromSeconds(0)).toBe('0s');
  });

  it('returns "0s" for negative values', () => {
    expect(formatUptimeFromSeconds(-10)).toBe('0s');
  });

  it('formats seconds only', () => {
    expect(formatUptimeFromSeconds(30)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatUptimeFromSeconds(90)).toBe('1m 30s');
  });

  it('formats hours and minutes', () => {
    expect(formatUptimeFromSeconds(3700)).toBe('1h 1m');
  });

  it('formats days, hours, and minutes', () => {
    expect(formatUptimeFromSeconds(90061)).toBe('1d 1h 1m');
  });
});

describe('formatUptime', () => {
  it('end-to-end: parses and formats "2d3h5m10s"', () => {
    expect(formatUptime('2d3h5m10s')).toBe('2d 3h 5m');
  });

  it('returns "0s" for null input', () => {
    expect(formatUptime(null)).toBe('0s');
  });

  it('returns "0s" for undefined input', () => {
    expect(formatUptime(undefined)).toBe('0s');
  });
});
