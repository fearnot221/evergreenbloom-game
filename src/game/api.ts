import { useEffect, useSyncExternalStore } from 'react';

import type { PrizeTier } from '../data/stamps';

export type Receipt = { id: string; redeemed_at: string; reviewer: string };
/** One prize tier as the server sees it for this account. */
export type PrizeState = { eligible: boolean; left: number; redemption: Receipt | null };
export type GameState = {
  user: {
    id: string;
    username: string;
    nickname: string | null;
    role: 'player' | 'staff';
    /** The system admin, who manages the staff list. */
    admin: boolean;
    /** A Google sign-in that has not picked its account ID and nickname yet. */
    setup: boolean;
  };
  stamps: Record<string, string>;
  /** Shown once the account can redeem any prize; one code covers both tiers. */
  redeemCode: string | null;
  prizes: Record<PrizeTier, PrizeState>;
  /** This player's uploaded photos, and whether the organisers picked each one. */
  photos: Record<string, { picked: boolean }>;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, value?: unknown, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      ...(value === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
          }),
    });
  } catch {
    throw new Error('目前無法連線，請恢復連線後重試。集章與兌獎需要伺服器確認。');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(response.status, data?.error ?? '服務暫時無法使用，請稍後再試。');
  if (data === null) throw new Error('伺服器回應格式錯誤，請稍後重試。');
  return data;
}

/*
 * One account for the whole app: the nav, the stamp book, the map and the staff page
 * read the same store, so signing in or out anywhere updates them all at once.
 */
type Account = { data: GameState | null; loading: boolean; error: string };
let account: Account = { data: null, loading: true, error: '' };
const listeners = new Set<() => void>();
const set = (next: Partial<Account>) => {
  account = { ...account, ...next };
  for (const listener of listeners) listener();
};
const serverAccount: Account = { data: null, loading: true, error: '' };

let lastRefresh = 0;
let inflight: Promise<void> | null = null;

/** Re-read the server record. Calls made together (the nav and a page) share one request. */
function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = load().finally(() => {
    inflight = null;
    lastRefresh = Date.now();
  });
  return inflight;
}

async function load() {
  set({ loading: true, error: '' });
  try {
    set({ data: await api<GameState>('/me') });
  } catch (error) {
    set({
      data: null,
      error: error instanceof ApiError && error.status === 401 ? '' : (error as Error).message,
    });
  } finally {
    set({ loading: false });
  }
}

async function logout() {
  set({ loading: true, error: '' });
  try {
    await api('/logout', {});
    set({ data: null });
  } catch (error) {
    set({ error: (error as Error).message });
  } finally {
    set({ loading: false });
  }
}

const setData = (state: GameState | null) => set({ data: state, error: '' });

export function useAccount() {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => account,
    () => serverAccount,
  );
  // Each page re-reads the server record when it opens, so progress is never stale.
  useEffect(() => {
    // Opening a page re-reads progress, unless another component just did.
    if (Date.now() - lastRefresh > 2000) void refresh();
  }, []);
  return { ...state, setData, refresh, logout };
}

export const savedTime = (value: string) =>
  new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
