import { pino } from "pino";
import { env } from "../config/env.js";

/** Journalisation structurée — aucun `console.log` dans le code applicatif (§11). */
export const logger = pino({
  level: env.isTest ? "silent" : env.LOG_LEVEL,
  base: { service: "belezma-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.refreshToken",
    ],
    censor: "[masqué]",
  },
  transport: env.isProduction
    ? undefined
    : { target: "pino/file", options: { destination: 1 } },
});
