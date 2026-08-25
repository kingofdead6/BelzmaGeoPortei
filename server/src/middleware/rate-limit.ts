import rateLimit, { type Options } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env.js";

/** Réponse d'un limiteur — même enveloppe `{ error }` que le reste de l'API. */
function limitHandler(message: string): Options["handler"] {
  return (_req, res) => {
    res.status(429).json({ error: { code: "RATE_LIMITED", message } });
  };
}

const shared = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Les tests d'intégration enchaînent les requêtes : le plafond les gênerait.
  skip: () => env.isTest,
} as const;

/** 100 requêtes / 15 min / IP (§6). */
export const generalLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 100,
  handler: limitHandler("Trop de requêtes. Patientez quelques minutes avant de réessayer."),
});

/** 5 tentatives de connexion / 15 min / (IP + adresse e-mail) (§6). */
export const loginLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    return `${req.ip ?? "inconnu"}:${email}`;
  },
  handler: limitHandler(
    "Cinq tentatives de connexion ont échoué. Réessayez dans quinze minutes ou réinitialisez votre mot de passe.",
  ),
});

/** 20 dépôts / heure / utilisateur (§6). */
export const uploadLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req: Request) => req.auth?.userId ?? req.ip ?? "inconnu",
  handler: limitHandler("Vous avez atteint la limite de vingt dépôts par heure. Réessayez plus tard."),
});

/** Protège les routes d'envoi d'e-mail contre l'énumération d'adresses. */
export const accountRecoveryLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: limitHandler("Trop de demandes. Réessayez dans une heure."),
});
