import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutReturnUrls,
  onboardingRedirectTarget,
  onboardingReturnUrls,
  paymentWebReturnAllowedBaseUrls,
  paymentWebReturnBaseUrl,
  resolveWebReturnBaseUrl,
} from "./paymentReturnUrls";

test("native Checkout returns through fixed API deep-link handlers", () => {
  assert.deepEqual(
    checkoutReturnUrls({
      appointmentId: "appointment-id",
      returnTarget: "native",
      apiBaseUrl: "https://api.example.com",
    }),
    {
      successUrl:
        "https://api.example.com/api/payments/checkout/success?appointmentId=appointment-id",
      cancelUrl:
        "https://api.example.com/api/payments/checkout/cancel?appointmentId=appointment-id",
    },
  );
});

test("web Checkout returns to the configured app route", () => {
  assert.deepEqual(
    checkoutReturnUrls({
      appointmentId: "appointment-id",
      returnTarget: "web",
      apiBaseUrl: "https://api.example.com",
      webBaseUrl: "https://app.example.com/healers/",
    }),
    {
      successUrl:
        "https://app.example.com/healers/checkout-return?appointmentId=appointment-id&status=success",
      cancelUrl:
        "https://app.example.com/healers/checkout-return?appointmentId=appointment-id&status=cancelled",
    },
  );
});

test("web Checkout requires an explicit return base URL", () => {
  assert.throws(() => paymentWebReturnBaseUrl({ NODE_ENV: "development" }));
  assert.throws(() => paymentWebReturnBaseUrl({ NODE_ENV: "production" }));
});
test("allowlist combines the listed web origins with the legacy base URL", () => {
  assert.deepEqual(
    paymentWebReturnAllowedBaseUrls({
      NODE_ENV: "production",
      PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS:
        "https://healers.example, https://www.healers.example/site",
      PAYMENT_WEB_RETURN_BASE_URL: "https://app.example.com",
    }),
    [
      "https://healers.example/",
      "https://www.healers.example/site/",
      "https://app.example.com/",
    ],
  );
});

test("allowlist rejects plain-HTTP entries in production", () => {
  assert.throws(() =>
    paymentWebReturnAllowedBaseUrls({
      NODE_ENV: "production",
      PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "http://localhost:5173",
    }),
  );
  assert.deepEqual(
    paymentWebReturnAllowedBaseUrls({
      NODE_ENV: "development",
      PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "http://localhost:5173",
    }),
    ["http://localhost:5173/"],
  );
});

test("a requested allowlisted web base URL is returned normalized", () => {
  const env = {
    NODE_ENV: "production",
    PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "https://healers.example",
    PAYMENT_WEB_RETURN_BASE_URL: "https://app.example.com",
  };
  assert.equal(
    resolveWebReturnBaseUrl("https://healers.example", env),
    "https://healers.example/",
  );
  // A site served below an allowlisted origin keeps its base path.
  assert.equal(
    resolveWebReturnBaseUrl("https://healers.example/web/", env),
    "https://healers.example/web/",
  );
  assert.equal(
    resolveWebReturnBaseUrl("https://app.example.com/", env),
    "https://app.example.com/",
  );
});

test("a requested web base URL outside the allowlist is a 400", () => {
  const env = {
    NODE_ENV: "production",
    PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "https://healers.example/site",
    PAYMENT_WEB_RETURN_BASE_URL: "https://app.example.com",
  };
  for (const bad of [
    "https://evil.example",
    "https://healers.example.evil.example",
    "https://healers.example", // above the allowlisted path
    "http://healers.example/site",
    "https://healers.example/site?x=1",
    "not a url",
  ]) {
    assert.throws(
      () => resolveWebReturnBaseUrl(bad, env),
      (error: unknown) =>
        error instanceof Error && (error as { status?: number }).status === 400,
      `expected 400 for ${bad}`,
    );
  }
});

test("an absent requested base URL falls back to the legacy configured URL", () => {
  const env = {
    NODE_ENV: "production",
    PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "https://healers.example",
    PAYMENT_WEB_RETURN_BASE_URL: "https://app.example.com",
  };
  assert.equal(resolveWebReturnBaseUrl(undefined, env), "https://app.example.com/");
  assert.equal(resolveWebReturnBaseUrl("", env), "https://app.example.com/");
  assert.throws(() =>
    resolveWebReturnBaseUrl(null, {
      NODE_ENV: "production",
      PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "https://healers.example",
    }),
  );
});

test("localhost dev origins are accepted only outside production", () => {
  assert.equal(
    resolveWebReturnBaseUrl("http://localhost:5173/", {
      NODE_ENV: "development",
      PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "http://localhost:5173",
    }),
    "http://localhost:5173/",
  );
  assert.throws(() =>
    resolveWebReturnBaseUrl("http://localhost:5173/", {
      NODE_ENV: "production",
      PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "https://healers.example",
    }),
  );
});

test("web Checkout returns to a localhost dev site outside production", () => {
  assert.deepEqual(
    checkoutReturnUrls({
      appointmentId: "appointment-id",
      returnTarget: "web",
      apiBaseUrl: "https://api.example.com",
      webBaseUrl: "http://localhost:5173/",
    }),
    {
      successUrl:
        "http://localhost:5173/checkout-return?appointmentId=appointment-id&status=success",
      cancelUrl:
        "http://localhost:5173/checkout-return?appointmentId=appointment-id&status=cancelled",
    },
  );
});

test("onboarding links return through the API handlers, carrying the web site when given", () => {
  assert.deepEqual(onboardingReturnUrls({ apiBaseUrl: "https://api.example.com" }), {
    returnUrl: "https://api.example.com/api/payments/onboarding/return",
    refreshUrl: "https://api.example.com/api/payments/onboarding/refresh",
  });
  assert.deepEqual(
    onboardingReturnUrls({
      apiBaseUrl: "https://api.example.com",
      webBaseUrl: "https://healers.example/",
    }),
    {
      returnUrl:
        "https://api.example.com/api/payments/onboarding/return?web=https%3A%2F%2Fhealers.example%2F",
      refreshUrl:
        "https://api.example.com/api/payments/onboarding/refresh?web=https%3A%2F%2Fhealers.example%2F",
    },
  );
});

test("the onboarding return handler goes back to an allowlisted web site, else the app", () => {
  const env = {
    NODE_ENV: "production",
    PAYMENT_WEB_RETURN_ALLOWED_BASE_URLS: "https://healers.example",
  };
  assert.equal(
    onboardingRedirectTarget("https://healers.example/", "return", env),
    "https://healers.example/manage/payments?onboarding=return",
  );
  assert.equal(
    onboardingRedirectTarget("https://healers.example/", "refresh", env),
    "https://healers.example/manage/payments?onboarding=refresh",
  );
  assert.equal(onboardingRedirectTarget(undefined, "return", env), "healers-app://manage/payments");
  assert.equal(onboardingRedirectTarget("", "return", env), "healers-app://manage/payments");
  assert.equal(
    onboardingRedirectTarget("https://evil.example/", "return", env),
    "healers-app://manage/payments",
  );
  assert.equal(
    onboardingRedirectTarget(["https://healers.example/"], "return", env),
    "healers-app://manage/payments",
  );
});
