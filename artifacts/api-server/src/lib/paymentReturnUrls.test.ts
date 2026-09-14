import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutReturnUrls,
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

test("web Checkout requires an explicit return base URL", () => {
  assert.throws(() => paymentWebReturnBaseUrl({ NODE_ENV: "development" }));
  assert.throws(() => paymentWebReturnBaseUrl({ NODE_ENV: "production" }));
});