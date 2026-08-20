import { fileURLToPath } from "node:url";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/errors";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
