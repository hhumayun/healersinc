import { Router, type IRouter } from "express";
import type { AppConfig } from "@workspace/api-zod";
import { DEFAULT_CURRENCY, MODALITIES, PAYMENTS_ENABLED } from "../lib/config";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  const config: AppConfig = {
    paymentsEnabled: PAYMENTS_ENABLED,
    currency: DEFAULT_CURRENCY,
    modalities: MODALITIES,
  };

  res.json(config);
});

export default router;
