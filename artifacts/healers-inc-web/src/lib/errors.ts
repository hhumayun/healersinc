/**
 * Turns an API failure into something worth showing a person. The fetch layer
 * prefixes its own `HTTP 401 Unauthorized:` onto the message, and the server's
 * own wording lives in the response body, so prefer the body.
 *
 * Kept in step with the app's helper in artifacts/healers-app/components/AuthShared.tsx.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err && typeof err === 'object') {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
      const error = (data as { error?: unknown }).error;
      if (typeof error === 'string' && error.trim()) return error.trim();
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.replace(/^HTTP\s+\d+[^:]*:\s*/i, '').trim();
    }
  }
  return fallback;
}

/** HTTP status of a failed request, when the fetch layer recorded one. */
export function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}
