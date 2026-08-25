import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "belezma_refresh";

/**
 * Le jeton de rafraîchissement ne transite que par un cookie httpOnly, jamais
 * par le corps de la réponse ni par `localStorage` (§6).
 */
function cookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    path: "/api/v1/auth",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions(expiresAt));
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}
