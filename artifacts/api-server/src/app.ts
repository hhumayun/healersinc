import { fileURLToPath } from "node:url";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/errors";
import { WebhookHandlers } from "./webhookHandlers";
import { paymentPolicy } from "./lib/paymentPolicy";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    if (!paymentPolicy.enabled) {
      res.status(404).json({ error: "not_found", message: "Payments are disabled." });
      return;
    }
    const header = req.headers["stripe-signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      res.status(400).json({ error: "invalid_webhook", message: "Missing signature." });
      return;
    }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, signature);
      res.json({ received: true });
    } catch (err) {
      req.log.warn({ err }, "Stripe webhook rejected");
      res.status(400).json({ error: "invalid_webhook", message: "Webhook rejected." });
    }
  },
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get(
  ["/api/payments/onboarding/return", "/api/payments/onboarding/refresh"],
  (_req, res) => {
    res.redirect(303, "healers-app://manage/payments");
  },
);
app.get(
  ["/api/payments/checkout/success", "/api/payments/checkout/cancel"],
  (req, res) => {
    const appointmentId =
      typeof req.query["appointmentId"] === "string"
        ? req.query["appointmentId"]
        : "";
    const safeId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(appointmentId)
      ? appointmentId
      : "";
    res.redirect(
      303,
      safeId
        ? `healers-app://appointment/${encodeURIComponent(safeId)}`
        : "healers-app://manage/payments",
    );
  },
);

// Practitioner portraits and cover art ship with the server so the mobile app
// has real imagery without depending on an external CDN.
const mediaRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/media",
);
app.use(
  "/api/media",
  express.static(mediaRoot, { maxAge: "1h", fallthrough: true }),
);

app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "not_found",
    message: "That endpoint does not exist.",
  });
});

app.use(errorHandler);

export default app;
