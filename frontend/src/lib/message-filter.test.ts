import { describe, it, expect } from 'vitest';

import { matchesSearch, filterMessages } from './message-filter';

const MESSAGE = {
  id: '1',
  subject: 'orders.created',
  data: '{"customer":"ACME"}',
  headers: { 'X-Trace': 'abc123' },
  timestamp: new Date(),
};

describe('matchesSearch', () => {
  it('matches on data, subject and headers, case-insensitively', () => {
    expect(matchesSearch(MESSAGE, 'acme')).toBe(true);
    expect(matchesSearch(MESSAGE, 'ORDERS')).toBe(true);
    expect(matchesSearch(MESSAGE, 'abc123')).toBe(true);
  });

  it('returns true for an empty or whitespace query', () => {
    expect(matchesSearch(MESSAGE, '')).toBe(true);
    expect(matchesSearch(MESSAGE, '   ')).toBe(true);
    expect(matchesSearch(MESSAGE, undefined)).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesSearch(MESSAGE, 'nothing-here')).toBe(false);
  });

  it('handles messages without headers', () => {
    expect(matchesSearch({ ...MESSAGE, headers: undefined }, 'acme')).toBe(true);
    expect(matchesSearch({ ...MESSAGE, headers: undefined }, 'abc123')).toBe(false);
  });
});

describe('filterMessages', () => {
  const messages = [
    { ...MESSAGE, id: '1', subject: 'orders', data: 'hello' },
    { ...MESSAGE, id: '2', subject: 'events', data: 'hello' },
    { ...MESSAGE, id: '3', subject: 'orders', data: 'goodbye' },
  ];

  it('filters by subject', () => {
    expect(filterMessages(messages, 'orders')).toHaveLength(2);
  });

  it('filters by subject and search together', () => {
    const result = filterMessages(messages, 'orders', 'hello');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterMessages(messages, 'missing')).toEqual([]);
  });
});
