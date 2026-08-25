import { createHash, randomBytes } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Types } from "mongoose";
import type { UserRole } from "@belezma/shared";
import { env } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

/** Le jeton d'accès est court (15 min) et conservé en mémoire côté client (§6). */
export function signAccessToken(userId: string, role: UserRole): { token: string; expiresIn: number } {
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"] };
  const token = jwt.sign({ sub: userId, role } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, options);
  const decoded = jwt.decode(token) as { exp?: number; iat?: number } | null;
  const expiresIn = decoded?.exp && decoded.iat ? decoded.exp - decoded.iat : 900;
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof payload === "string" || !payload.sub) {
      throw ApiError.unauthenticated("Jeton d'accès invalide.");
    }
    return { sub: String(payload.sub), role: (payload as { role: UserRole }).role };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthenticated("Votre session a expiré. Reconnectez-vous.");
    }
    throw ApiError.unauthenticated("Jeton d'accès invalide.");
  }
}

/** Empreinte stockée en base : le jeton en clair n'existe que dans le cookie. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export async function issueRefreshToken(
  userId: Types.ObjectId | string,
  options: { family?: string; userAgent?: string | null; ip?: string | null } = {},
): Promise<IssuedRefreshToken> {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    family: options.family ?? randomBytes(16).toString("hex"),
    expiresAt,
    userAgent: options.userAgent ?? null,
    ip: options.ip ?? null,
  });

  return { token, expiresAt };
}

export interface RotationResult {
  userId: string;
  token: string;
  expiresAt: Date;
}

/**
 * Rotation à chaque usage. Si un jeton déjà révoqué est présenté, toute la
 * famille est révoquée : c'est la détection de réutilisation exigée au §6.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<RotationResult> {
  const tokenHash = hashToken(presentedToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    throw ApiError.unauthenticated("Session inconnue. Reconnectez-vous.");
  }

  if (stored.revokedAt) {
    await RefreshToken.updateMany(
      { family: stored.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    logger.warn({ family: stored.family, user: String(stored.user) }, "Réutilisation d'un jeton de rafraîchissement — famille révoquée");
    throw ApiError.unauthenticated("Session invalidée pour raison de sécurité. Reconnectez-vous.");
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthenticated("Votre session a expiré. Reconnectez-vous.");
  }

  const next = await issueRefreshToken(stored.user, {
    family: stored.family,
    userAgent: context.userAgent ?? null,
    ip: context.ip ?? null,
  });

  stored.revokedAt = new Date();
  stored.replacedBy = hashToken(next.token);
  await stored.save();

  return { userId: String(stored.user), token: next.token, expiresAt: next.expiresAt };
}

export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(presentedToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeAllUserTokens(userId: Types.ObjectId | string): Promise<void> {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/** Jeton opaque à usage unique — vérification d'adresse, réinitialisation. */
export function createOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export { hashToken };
