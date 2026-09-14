export type PaymentReturnTarget = "native" | "web" | "site";

/**
 * Where the Healers Inc website lives under the Replit path router. Kept in
 * step with `BASE_PATH` in artifacts/healers-inc-web/.replit-artifact/artifact.toml.
 */
const DEFAULT_SITE_BASE_PATH = "/healers-inc-web/";

function normalizedHttpsBaseUrl(value: string, label: string): string {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const url = new URL(candidate);
  if (
    url.protocol !== "https:" ||
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

  const expoDevelopmentDomain = env["REPLIT_EXPO_DEV_DOMAIN"]?.trim();
  if (env["NODE_ENV"] !== "production" && expoDevelopmentDomain) {
    return normalizedHttpsBaseUrl(
      expoDevelopmentDomain,
      "REPLIT_EXPO_DEV_DOMAIN",
    );
  }

  throw new Error(
    "PAYMENT_WEB_RETURN_BASE_URL is required for web Checkout in production.",
  );
}

/**
 * Return base for Checkout started from the website. Composed on the server
 * from allowlisted configuration — never from anything the caller sends — so
 * a hosted Checkout session can only ever come back to our own origin.
 */
export function paymentSiteReturnBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env["PAYMENT_SITE_RETURN_BASE_URL"]?.trim();
  if (configured) {
    return normalizedHttpsBaseUrl(configured, "PAYMENT_SITE_RETURN_BASE_URL");
  }

  const domain = env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (domain) {
    const basePath = env["PAYMENT_SITE_RETURN_BASE_PATH"]?.trim()
      ?? DEFAULT_SITE_BASE_PATH;
    return normalizedHttpsBaseUrl(
      `${domain}${basePath.startsWith("/") ? basePath : `/${basePath}`}`,
      "REPLIT_DOMAINS",
    );
  }

  throw new Error(
    "PAYMENT_SITE_RETURN_BASE_URL is required for website Checkout.",
  );
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

  // Resolved lazily: an explicit base must not require the environment that
  // only the fallback needs.
  const baseUrl = normalizedHttpsBaseUrl(
    input.webBaseUrl ??
      (input.returnTarget === "site"
        ? paymentSiteReturnBaseUrl()
        : paymentWebReturnBaseUrl()),
    "Web payment return URL",
  );
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