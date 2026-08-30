import { describe, it, expect } from 'vitest';

import { readOAuthToken } from './oauth-token';

describe('readOAuthToken', () => {
  it('reads the token from the URL fragment', () => {
    expect(readOAuthToken({ search: '', hash: '#token=abc123' })).toBe('abc123');
  });

  it('falls back to the query string for older backends', () => {
    expect(readOAuthToken({ search: '?token=legacy', hash: '' })).toBe('legacy');
  });

  it('prefers the fragment when both are present', () => {
    expect(readOAuthToken({ search: '?token=legacy', hash: '#token=fresh' })).toBe('fresh');
  });

  it('returns null when there is no token', () => {
    expect(readOAuthToken({ search: '', hash: '' })).toBeNull();
    expect(readOAuthToken({ search: '?other=1', hash: '#state=xyz' })).toBeNull();
  });

  it('decodes percent-encoded tokens', () => {
    expect(readOAuthToken({ search: '', hash: '#token=a%2Bb' })).toBe('a+b');
  });
});
