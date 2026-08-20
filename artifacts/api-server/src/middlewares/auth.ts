import type { RequestHandler } from "express";
import { bearerToken, resolveSession, type AuthContext } from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Resolves the bearer token on every request. Routes then assert the role they
 * need — authorization is always derived from the session, never from anything
 * the client sends in a body or query string.
 */
export const attachAuth: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }

  resolveSession(token)
    .then((auth) => {
      if (auth) req.auth = auth;
      next();
    })
    .catch(next);
};
