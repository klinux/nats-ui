/**
 * Extracts the JWT handed back by the OAuth2 callback.
 *
 * The backend returns it in the URL fragment, which browsers never send to a
 * server — keeping the token out of proxy access logs and Referer headers. The
 * query string is still read as a fallback so a cached frontend paired with an
 * older backend keeps working.
 */
export function readOAuthToken(location: { search: string; hash: string }): string | null {
  const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
  if (fromHash) return fromHash;

  return new URLSearchParams(location.search).get('token');
}
