import bcrypt from "bcrypt";
import { Router } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@belezma/shared";
import { User } from "../models/index.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { accountRecoveryLimiter, loginLimiter } from "../middleware/rate-limit.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { sendData } from "../utils/respond.js";
import { toSessionUser } from "../services/serialize.js";
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "../services/cookies.js";
import {
  createOpaqueToken,
  hashToken,
  issueRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../services/tokens.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/mailer.js";
import { logger } from "../utils/logger.js";

export const authRouter: Router = Router();

const BCRYPT_COST = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Réponse identique quelle que soit l'issue d'une demande de récupération :
 * l'API ne doit jamais révéler qu'une adresse est enregistrée.
 */
const RECOVERY_ACK =
  "Si un compte correspond à cette adresse, vous recevrez un message dans quelques instants.";

authRouter.post(
  "/register",
  accountRecoveryLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, displayName, organization } = req.body as ReturnType<
      typeof registerSchema.parse
    >;

    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      throw ApiError.conflict(
        "Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.",
      );
    }

    const { token: verifyToken, hash: verifyHash } = createOpaqueToken();

    const user = await User.create({
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      displayName,
      organization: organization ?? null,
      verifyToken: verifyHash,
    });

    await sendVerificationEmail(email, displayName, verifyToken);

    const { token: accessToken, expiresIn } = signAccessToken(String(user._id), user.role);
    const refresh = await issueRefreshToken(user._id, {
      userAgent: req.get("user-agent") ?? null,
      ip: req.ip ?? null,
    });
    setRefreshCookie(res, refresh.token, refresh.expiresAt);

    sendData(res, { user: toSessionUser(user), accessToken, expiresIn }, undefined, 201);
  }),
);

authRouter.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as ReturnType<typeof loginSchema.parse>;

    const user = await User.findOne({ email }).select("+passwordHash");

    // Un hachage systématique évite de distinguer « compte inconnu » de
    // « mot de passe incorrect » par le temps de réponse.
    const hash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    const matches = await bcrypt.compare(password, hash);

    if (!user || !matches) {
      throw ApiError.unauthenticated("Adresse ou mot de passe incorrect.");
    }

    if (user.status === "suspended") {
      throw ApiError.forbidden(
        "Votre compte est suspendu. Écrivez à l'équipe du parc pour en connaître le motif.",
      );
    }

    const { token: accessToken, expiresIn } = signAccessToken(String(user._id), user.role);
    const refresh = await issueRefreshToken(user._id, {
      userAgent: req.get("user-agent") ?? null,
      ip: req.ip ?? null,
    });
    setRefreshCookie(res, refresh.token, refresh.expiresAt);

    sendData(res, { user: toSessionUser(user), accessToken, expiresIn });
  }),
);

/** Rotation du jeton de rafraîchissement à chaque usage (§6). */
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!presented) {
      throw ApiError.unauthenticated("Aucune session en cours.");
    }

    const rotated = await rotateRefreshToken(presented, {
      userAgent: req.get("user-agent") ?? null,
      ip: req.ip ?? null,
    });

    const user = await User.findById(rotated.userId);
    if (!user || user.status === "suspended") {
      clearRefreshCookie(res);
      throw ApiError.unauthenticated("Session invalide. Reconnectez-vous.");
    }

    const { token: accessToken, expiresIn } = signAccessToken(String(user._id), user.role);
    setRefreshCookie(res, rotated.token, rotated.expiresAt);

    sendData(res, { user: toSessionUser(user), accessToken, expiresIn });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (presented) await revokeRefreshToken(presented);
    clearRefreshCookie(res);
    sendData(res, { loggedOut: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth?.userId);
    if (!user) throw ApiError.unauthenticated("Compte introuvable.");
    sendData(res, toSessionUser(user));
  }),
);

authRouter.post(
  "/forgot-password",
  accountRecoveryLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as ReturnType<typeof forgotPasswordSchema.parse>;
    const user = await User.findOne({ email });

    if (user) {
      const { token, hash } = createOpaqueToken();
      user.resetToken = hash;
      user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      await sendPasswordResetEmail(user.email, user.displayName, token);
    } else {
      logger.info({ email }, "Demande de réinitialisation pour une adresse inconnue");
    }

    sendData(res, { message: RECOVERY_ACK });
  }),
);

authRouter.post(
  "/reset-password",
  accountRecoveryLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as ReturnType<typeof resetPasswordSchema.parse>;

    const user = await User.findOne({
      resetToken: hashToken(token),
      resetTokenExpires: { $gt: new Date() },
    }).select("+resetToken +resetTokenExpires");

    if (!user) {
      throw ApiError.badRequest(
        "Ce lien de réinitialisation est expiré ou déjà utilisé. Demandez-en un nouveau.",
      );
    }

    user.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    // Toutes les sessions ouvertes sont invalidées : si le compte était
    // compromis, l'intrus perd immédiatement l'accès.
    await revokeAllUserTokens(user._id);
    clearRefreshCookie(res);

    sendData(res, {
      message: "Votre mot de passe est modifié. Connectez-vous avec le nouveau.",
    });
  }),
);

authRouter.get(
  "/verify-email/:token",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 10) {
      throw ApiError.badRequest("Lien de confirmation invalide.");
    }

    const user = await User.findOne({ verifyToken: hashToken(token) }).select("+verifyToken");
    if (!user) {
      throw ApiError.badRequest(
        "Ce lien de confirmation n'est plus valable. Votre adresse est peut-être déjà confirmée.",
      );
    }

    user.emailVerified = true;
    user.verifyToken = null;
    await user.save();

    sendData(res, { message: "Votre adresse est confirmée.", emailVerified: true });
  }),
);
