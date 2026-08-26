import { Router } from "express";
import multer from "multer";
import { idParamSchema, updateProfileSchema, UPLOAD_LIMITS } from "@belezma/shared";
import { Contribution, User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rate-limit.js";
import { validate, validatedParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { sendData } from "../utils/respond.js";
import { toContribution, toPublicUser, toSessionUser } from "../services/serialize.js";
import { buildImageUrls, destroyAsset, uploadImage } from "../services/cloudinary.js";
import { prepareImage } from "../services/image.js";

export const usersRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.imageBytes, files: 1 },
});

/** Profil public : le compte et ses contributions publiées seulement. */
usersRouter.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, idParamSchema);

    const user = await User.findById(id).lean();
    if (!user || user.status === "suspended") {
      throw ApiError.notFound("Ce profil n'existe pas.");
    }

    const contributions = await Contribution.find({ owner: id, visibility: "public" })
      .populate("owner", "displayName avatarUrl organization")
      .sort({ publishedAt: -1 })
      .limit(24)
      .lean();

    sendData(res, {
      user: toPublicUser(user),
      contributions: contributions.map(toContribution),
    });
  }),
);

usersRouter.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const changes = req.body as ReturnType<typeof updateProfileSchema.parse>;

    const user = await User.findByIdAndUpdate(req.auth?.userId, { $set: changes }, { new: true });
    if (!user) throw ApiError.notFound("Compte introuvable.");

    sendData(res, toSessionUser(user));
  }),
);

usersRouter.post(
  "/me/avatar",
  requireAuth,
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest("Aucune image reçue. Déposez un fichier JPEG, PNG ou WebP.");
    }

    const userId = req.auth?.userId as string;
    const prepared = await prepareImage(req.file.buffer, req.file.originalname);
    const uploaded = await uploadImage(prepared.buffer, { userId, kind: "avatar" });

    const user = await User.findById(userId).select("+avatarPublicId");
    if (!user) throw ApiError.notFound("Compte introuvable.");

    const previous = user.avatarPublicId;
    user.avatarPublicId = uploaded.publicId;
    user.avatarUrl = buildImageUrls(uploaded.publicId).thumbUrl;
    await user.save();

    // L'ancienne image n'est supprimée qu'une fois la nouvelle enregistrée.
    if (previous) await destroyAsset(previous, "image", {});

    sendData(res, toSessionUser(user));
  }),
);
