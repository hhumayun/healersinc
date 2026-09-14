import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutReturnUrls,
  paymentSiteReturnBaseUrl,
  paymentWebReturnBaseUrl,
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

test("Expo development domain is allowed only outside production", () => {
  assert.equal(
    paymentWebReturnBaseUrl({
      NODE_ENV: "development",
      REPLIT_EXPO_DEV_DOMAIN: "preview.expo.example.com",
    }),
    "https://preview.expo.example.com/",
  );
  assert.throws(() =>
    paymentWebReturnBaseUrl({
      NODE_ENV: "production",
      REPLIT_EXPO_DEV_DOMAIN: "preview.expo.example.com",
    }),
  );
});

test("website Checkout returns to the site's own landing route", () => {
  assert.deepEqual(
    checkoutReturnUrls({
      appointmentId: "appointment-id",
      returnTarget: "site",
      apiBaseUrl: "https://api.example.com",
      webBaseUrl: "https://site.example.com/healers-inc-web/",
    }),
    {
      successUrl:
        "https://site.example.com/healers-inc-web/checkout-return?appointmentId=appointment-id&status=success",
      cancelUrl:
        "https://site.example.com/healers-inc-web/checkout-return?appointmentId=appointment-id&status=cancelled",
    },
  );
});

test("the site return base is composed from the Replit domain and base path", () => {
  assert.equal(
    paymentSiteReturnBaseUrl({
      REPLIT_DOMAINS: "site.example.com,other.example.com",
    }),
    "https://site.example.com/healers-inc-web/",
  );
  assert.equal(
    paymentSiteReturnBaseUrl({
      REPLIT_DOMAINS: "site.example.com",
      PAYMENT_SITE_RETURN_BASE_PATH: "/preview/",
    }),
    "https://site.example.com/preview/",
  );
});

test("an explicit site return base wins, and must be a plain HTTPS base URL", () => {
  assert.equal(
    paymentSiteReturnBaseUrl({
      PAYMENT_SITE_RETURN_BASE_URL: "https://www.example.com/app",
      REPLIT_DOMAINS: "ignored.example.com",
    }),
    "https://www.example.com/app/",
  );
  assert.throws(() =>
    paymentSiteReturnBaseUrl({
      PAYMENT_SITE_RETURN_BASE_URL: "http://insecure.example.com",
    }),
  );
  assert.throws(() =>
    paymentSiteReturnBaseUrl({
      PAYMENT_SITE_RETURN_BASE_URL: "https://example.com/app?next=evil",
    }),
  );
});

test("website Checkout needs configuration when no domain is available", () => {
  assert.throws(() => paymentSiteReturnBaseUrl({}));
});
