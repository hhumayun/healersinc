/**
 * Pull a clean, human-readable message out of whatever the API / fetch layer
 * or Clerk throws. `ApiError` carries the server body on `.data` as
 * `{ error, message }`; Clerk errors carry an `errors` array; fall back to the
 * Error message otherwise.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err && typeof err === 'object') {
    const errors = (err as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as { longMessage?: unknown; message?: unknown };
      if (typeof first.longMessage === 'string' && first.longMessage.trim()) {
        return first.longMessage.trim();
      }
      if (typeof first.message === 'string' && first.message.trim()) {
        return first.message.trim();
      }
    }
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
      const error = (data as { error?: unknown }).error;
      if (typeof error === 'string' && error.trim()) return error.trim();
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      // Strip the "HTTP 401 Unauthorized: " prefix the fetch layer adds.
      return message.replace(/^HTTP\s+\d+[^:]*:\s*/i, '').trim();
    }
  }
  return fallback;
}

/** HTTP status of an `ApiError`, or null for anything else. */
export function errorStatus(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}
