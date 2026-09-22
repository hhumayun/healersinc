import { badRequest } from "./errors";

export type PaymentReturnTarget = "native" | "web";

function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Parse a base URL into `origin + path/` form. HTTPS only, except that plain
 * `http://localhost` (any port) is tolerated outside production so a local
 * Vite dev server can be a Checkout return target.
 */
function normalizedBaseUrl(
  value: string,
  label: string,
  options: { allowLocalhostHttp: boolean },
): string {
  const candidate = value.includes("://") ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${label} must be a plain HTTPS base URL.`);
  }
  const localhostHttp =
    options.allowLocalhostHttp &&
    url.protocol === "http:" &&
    isLocalhost(url.hostname);
  if (
    (url.protocol !== "https:" && !localhostHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be a plain HTTPS base URL.`);
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url.toString();
}

function normalizedHttpsBaseUrl(value: string, label: string): string {
  return normalizedBaseUrl(value, label, { allowLocalhostHttp: false });
}

export function paymentWebReturnBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env["PAYMENT_WEB_RETURN_BASE_URL"]?.trim();
  if (configured) {
    return normalizedHttpsBaseUrl(
      configured,
      "PAYMENT_WEB_RETURN_BASE_URL",
    );
  }

  throw new Error(
    "PAYMENT_WEB_RETURN_BASE_URL is required for web Checkout.",
  );
}

/**
 * Every web origin Stripe Checkout may return to: the comma-separated
 * `PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS` (e.g. the Healers Inc web site) plus
 * the legacy single `PAYMENT_WEB_RETURN_BASE_URL` (the Expo web build).
 * Entries are normalized to `origin/path/`; invalid entries throw at read time
 * so a misconfigured deployment fails loudly rather than silently narrowing the
 * allowlist. `http://localhost:*` is accepted only when `NODE_ENV` is not
 * `production`.
 */
export function paymentWebReturnAllowedBaseUrls(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const allowLocalhostHttp = env["NODE_ENV"] !== "production";
  const urls = new Set<string>();

  const listed = env["PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS"] ?? "";
  for (const raw of listed.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    urls.add(
      normalizedBaseUrl(entry, "PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS", {
        allowLocalhostHttp,
      }),
    );
  }

  const legacy = env["PAYMENT_WEB_RETURN_BASE_URL"]?.trim();
  if (legacy) {
    urls.add(normalizedHttpsBaseUrl(legacy, "PAYMENT_WEB_RETURN_BASE_URL"));
  }

  return [...urls];
}

/**
 * Pick the web base URL Checkout should return to. With no request the legacy
 * `PAYMENT_WEB_RETURN_BASE_URL` behaviour is kept. A requested base URL is
 * accepted only when its origin matches an allowlisted entry and its path sits
 * at or below that entry's path (so an allowlisted `https://site.example`
 * accepts a site served from `https://site.example/web/`). Anything else is a
 * 400, never a fallback, so a client cannot steer the return anywhere else.
 */
export function resolveWebReturnBaseUrl(
  requested: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const wanted = requested?.trim();
  if (!wanted) return paymentWebReturnBaseUrl(env);

  const allowLocalhostHttp = env["NODE_ENV"] !== "production";
  let normalized: string;
  try {
    normalized = normalizedBaseUrl(wanted, "returnBaseUrl", {
      allowLocalhostHttp,
    });
  } catch {
    throw badRequest("returnBaseUrl must be a plain HTTPS base URL.");
  }

  const candidate = new URL(normalized);
  const allowed = paymentWebReturnAllowedBaseUrls(env).some((entry) => {
    const base = new URL(entry);
    return (
      base.origin === candidate.origin &&
      candidate.pathname.startsWith(base.pathname)
    );
  });

  if (!allowed) {
    throw badRequest("returnBaseUrl is not an allowed web return origin.");
  }

  return normalized;
}

export function checkoutReturnUrls(input: {
  appointmentId: string;
  returnTarget: PaymentReturnTarget;
  apiBaseUrl: string;
  webBaseUrl?: string;
}): { successUrl: string; cancelUrl: string } {
  if (input.returnTarget === "native") {
    const successUrl = new URL(
      "/api/payments/checkout/success",
      input.apiBaseUrl,
    );
    const cancelUrl = new URL(
      "/api/payments/checkout/cancel",
      input.apiBaseUrl,
    );
    successUrl.searchParams.set("appointmentId", input.appointmentId);
    cancelUrl.searchParams.set("appointmentId", input.appointmentId);
    return {
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    };
  }

  // `webBaseUrl` has already been allowlisted by resolveWebReturnBaseUrl (or is
  // the configured default), so only the legacy fallback needs HTTPS enforced.
  const baseUrl = input.webBaseUrl
    ? normalizedBaseUrl(input.webBaseUrl, "Web payment return URL", {
        allowLocalhostHttp: process.env["NODE_ENV"] !== "production",
      })
    : paymentWebReturnBaseUrl();
  const successUrl = new URL("checkout-return", baseUrl);
  const cancelUrl = new URL("checkout-return", baseUrl);
  successUrl.searchParams.set("appointmentId", input.appointmentId);
  successUrl.searchParams.set("status", "success");
  cancelUrl.searchParams.set("appointmentId", input.appointmentId);
  cancelUrl.searchParams.set("status", "cancelled");
  return {
    successUrl: successUrl.toString(),
    cancelUrl: cancelUrl.toString(),
  };
}

/** Where the mobile app expects Stripe payout onboarding to land. */
export const NATIVE_ONBOARDING_RETURN = "healers-app://manage/payments";

/**
 * Return/refresh destinations for hosted Stripe Connect onboarding. Both point
 * at fixed API handlers; when the request came from an allowlisted web site,
 * that site's base URL rides along as `?web=` so the handler can send the
 * browser back to the site instead of the app scheme.
 */
export function onboardingReturnUrls(input: {
  apiBaseUrl: string;
  webBaseUrl?: string;
}): { returnUrl: string; refreshUrl: string } {
  const build = (outcome: "return" | "refresh") => {
    const url = new URL(`${input.apiBaseUrl}/api/payments/onboarding/${outcome}`);
    if (input.webBaseUrl) url.searchParams.set("web", input.webBaseUrl);
    return url.toString();
  };
  return { returnUrl: build("return"), refreshUrl: build("refresh") };
}

/**
 * Pick where the onboarding return handler should redirect. A `web` query
 * value is honoured only if it is still an allowlisted web base URL (it was
 * allowlisted when the link was created, but the allowlist may have changed
 * since); anything else falls back to the app scheme.
 */
export function onboardingRedirectTarget(
  webQuery: unknown,
  outcome: "return" | "refresh",
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (typeof webQuery !== "string" || !webQuery.trim()) {
    return NATIVE_ONBOARDING_RETURN;
  }
  try {
    const base = resolveWebReturnBaseUrl(webQuery, env);
    const url = new URL("manage/payments", base);
    url.searchParams.set("onboarding", outcome);
    return url.toString();
  } catch {
    return NATIVE_ONBOARDING_RETURN;
  }
}
