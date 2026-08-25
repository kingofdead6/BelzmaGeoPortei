import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { generalLimiter } from "./middleware/rate-limit.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
    }),
  );

  app.use(
    helmet({
      // L'API ne sert que du JSON ; le client est déployé séparément.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Les requêtes sans en-tête `Origin` (curl, sondes de santé) passent.
        if (!origin || env.CLIENT_ORIGIN.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origine non autorisée : ${origin}`));
      },
      credentials: true,
      exposedHeaders: ["x-request-id"],
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cookieParser());
  app.use(mongoSanitize({ replaceWith: "_" }));

  app.use("/api/v1", generalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
