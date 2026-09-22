import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

/**
 * The API server is a separate deployment, so every generated request (which
 * uses relative `/api/...` paths) needs an absolute base. Set `VITE_API_URL`
 * (e.g. `https://api.example.com`). Leave it unset only when the site is served
 * behind the same origin as the API.
 */
const configuredUrl = import.meta.env.VITE_API_URL as string | undefined;
export const API_BASE_URL = (configuredUrl ?? '').replace(/\/+$/, '');

setBaseUrl(API_BASE_URL || null);

export type SessionTokenGetter = () => Promise<string | null>;

let tokenGetter: SessionTokenGetter | null = null;

/**
 * Clerk mints short-lived session JWTs and refreshes them itself, so instead
 * of caching a token here the session provider registers Clerk's `getToken`
 * and the fetch layer asks for a fresh one on every request. This mirrors the
 * Expo app so both clients authenticate against the API the same way.
 */
export function setSessionTokenGetter(getter: SessionTokenGetter | null): void {
  tokenGetter = getter;
}

export async function getSessionToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}

setAuthTokenGetter(getSessionToken);

/** Turns an API-relative media path (`/api/media/...`) into a loadable URL. */
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Chat + notification stream. Browsers cannot set WebSocket handshake headers. */
export function realtimeUrl(token: string): string {
  const base = (API_BASE_URL || window.location.origin).replace(/^http/i, 'ws');
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}

/** Absolute URL for an API path, for links the browser follows directly. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
