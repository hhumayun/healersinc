import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod/v4";

/** An error with an HTTP status the client is meant to see. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown): HttpError =>
  new HttpError(400, "bad_request", message, details);

export const unauthorized = (message = "Please sign in to continue."): HttpError =>
  new HttpError(401, "unauthorized", message);

export const forbidden = (message = "You do not have access to this."): HttpError =>
  new HttpError(403, "forbidden", message);

export const notFound = (message = "We could not find that."): HttpError =>
  new HttpError(404, "not_found", message);

export const conflict = (message: string, code = "conflict"): HttpError =>
  new HttpError(409, code, message);

/** Turn a Zod issue list into one readable sentence. */
function describeZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return "Some of the details you entered are not valid.";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_failed",
      message: describeZodError(err),
      details: err.issues,
    });
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) {
      req.log.error({ err }, "Request failed");
    }
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  req.log.error({ err }, "Unhandled request error");
  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong on our side. Please try again.",
  });
};

/** Express 5 forwards rejected promises, but only from the handler itself. */
export function handler(
  fn: (...args: Parameters<RequestHandler>) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
