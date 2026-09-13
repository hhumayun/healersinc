import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

/**
 * The API server runs as a separate artifact on the same Replit domain, so every
 * generated request (which uses relative `/api/...` paths) needs an absolute base.
 */
const domain = process.env.EXPO_PUBLIC_DOMAIN;
export const API_BASE_URL = domain ? `https://${domain}` : '';

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

/** Chat + notification stream. React Native cannot set handshake headers. */
export function realtimeUrl(token: string): string {
  const base = API_BASE_URL.replace(/^http/i, 'ws');
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}
