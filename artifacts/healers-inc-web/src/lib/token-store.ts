/**
 * Where the browser keeps the session token.
 *
 * The API authenticates with a bearer token (see the server's
 * `attachAuth` middleware), so the browser has to hold one itself — there is
 * no cookie session to fall back on. `localStorage` survives a reload and a
 * new tab, which is what "stay signed in" means here.
 *
 * Every access is guarded: Safari's private mode and "block all cookies"
 * both make `localStorage` throw rather than return null.
 */
const KEY = 'healers.session.token';

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // A browser that refuses storage still gets a working session for this
    // tab; it just will not survive a reload.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
