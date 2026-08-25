import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserRole } from "@belezma/shared";
import { User } from "../models/User.js";
import { verifyAccessToken } from "../services/tokens.js";
import { ApiError } from "../utils/errors.js";
import { asyncHandler } from "../utils/async-handler.js";

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Vérifie le jeton d'accès puis recharge le rôle et le statut depuis la base :
 * une suspension ou un changement de rôle prend effet immédiatement, sans
 * attendre l'expiration du jeton (§6 — jamais de confiance dans la copie
 * client du rôle).
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = readBearer(req);
  if (!token) throw ApiError.unauthenticated();

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select("role status").lean();

  if (!user) throw ApiError.unauthenticated("Compte introuvable. Reconnectez-vous.");
  if (user.status === "suspended") {
    throw ApiError.forbidden("Votre compte est suspendu. Contactez l'équipe du parc.");
  }

  req.auth = { userId: String(user._id), role: user.role };
  next();
});

/** Renseigne `req.auth` si un jeton valide est présent, sans jamais échouer. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = readBearer(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select("role status").lean();
    if (user && user.status === "active") {
      req.auth = { userId: String(user._id), role: user.role };
    }
  } catch {
    // Un jeton expiré ne doit pas empêcher la lecture des données publiques.
  }
  next();
};

const ROLE_RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };

/** Le contrôle de rôle est refait côté serveur sur chaque route protégée (§6). */
export function requireRole(...roles: UserRole[]): RequestHandler {
  const minimum = Math.min(...roles.map((role) => ROLE_RANK[role]));
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(ApiError.unauthenticated());
      return;
    }
    if (ROLE_RANK[req.auth.role] < minimum) {
      next(ApiError.forbidden("Cette section est réservée à l'équipe du parc."));
      return;
    }
    next();
  };
}

export function isAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Autorise le propriétaire de la ressource, ou un rôle suffisant. */
export function requireOwnerOrRole(
  ownerIdOf: (req: Request) => Promise<string | null> | string | null,
  minimum: UserRole = "moderator",
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!req.auth) throw ApiError.unauthenticated();

    const ownerId = await ownerIdOf(req);
    if (ownerId === null) throw ApiError.notFound();

    if (ownerId === req.auth.userId || isAtLeast(req.auth.role, minimum)) {
      next();
      return;
    }
    throw ApiError.forbidden("Cette contribution appartient à un autre utilisateur.");
  });
}
