import { getSpot } from '../data/stamps';

export type Claim = { spot: string; key: string };

/** Only parse the handoff; the server alone decides whether this key is valid. */
export function readClaim(params: URLSearchParams): Claim | null {
  const spot = getSpot(params.get('spot'));
  const key = params.get('k')?.trim().toUpperCase();
  return spot && key && /^[A-Z0-9-]{1,80}$/.test(key) ? { spot: spot.id, key } : null;
}

/**
 * What a scanned QR code holds: a stamp link (`…/stamp/<spot>?k=<code>`, or any URL with
 * spot and k), or a bare station code. Any host is accepted because only the spot and
 * code are read and the server checks them; the app never navigates to the URL itself.
 */
export function readScan(text: string): { claim: Claim } | { code: string } | null {
  const value = text.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const params = new URLSearchParams(url.search);
      const path = url.pathname.match(/\/stamp\/([a-z-]+)\/?$/);
      if (path) params.set('spot', path[1]);
      const claim = readClaim(params);
      return claim ? { claim } : null;
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9-]{1,80}$/.test(value) ? { code: value.toUpperCase() } : null;
}
