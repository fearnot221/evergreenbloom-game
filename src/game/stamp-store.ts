import { getSpot } from '../data/stamps';

export type Claim = { spot: string; key: string };

/** Only parse the handoff; the server alone decides whether this key is valid. */
export function readClaim(params: URLSearchParams): Claim | null {
  const spot = getSpot(params.get('spot'));
  const key = params.get('k')?.trim().toUpperCase();
  return spot && key && /^[A-Z0-9-]{1,80}$/.test(key) ? { spot: spot.id, key } : null;
}
