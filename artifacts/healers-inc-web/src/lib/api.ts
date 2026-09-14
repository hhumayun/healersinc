import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

/**
 * The generated client requests API-relative paths (`/api/...`). Replit's
 * router serves this site and the API server from one domain, so those paths
 * resolve on their own and no base URL is needed.
 *
 * `VITE_API_BASE_URL` is the escape hatch for running the site against an API
 * on another origin; leave it unset in Replit.
 */
const configuredBase = import.meta.env['VITE_API_BASE_URL'] as string | undefined;

export const API_BASE_URL = configuredBase?.replace(/\/+$/, '') ?? '';

setBaseUrl(API_BASE_URL || null);

let sessionToken: string | null = null;

/** Kept in a module variable so the generated fetch layer can read it lazily. */
export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

setAuthTokenGetter(() => sessionToken);

/** Turns an API-relative media path (`/api/media/...`) into a loadable URL. */
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Chat + notification stream. A browser cannot set headers on a WebSocket
 * handshake either, so the server reads the token from the query string.
 */
export function realtimeUrl(token: string): string {
  const origin = API_BASE_URL || window.location.origin;
  const base = origin.replace(/^http/i, 'ws');
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}
