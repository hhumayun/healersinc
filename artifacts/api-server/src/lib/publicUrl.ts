/**
 * The HTTPS origin the API is reachable at from the outside world, e.g.
 * `https://api.healers.example`. Stripe webhooks and Checkout return URLs are
 * built from it, so it has to be the real public address of the deployment.
 */
export function publicApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env["PUBLIC_API_URL"]?.trim();
  if (!raw) {
    throw new Error("PUBLIC_API_URL is required (e.g. https://api.example.com).");
  }
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (url.protocol !== "https:" && env["NODE_ENV"] === "production") {
    throw new Error("PUBLIC_API_URL must be an HTTPS URL in production.");
  }
  return url.origin;
}
