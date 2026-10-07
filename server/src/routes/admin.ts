import { Router } from "express";
import type { FilterQuery } from "mongoose";
import {
  changeRoleSchema,
  changeStatusSchema,
  createLayerSchema,
  idParamSchema,
  layerIdParamSchema,
  listUsersQuerySchema,
  updateLayerSchema,
} from "@belezma/shared";
import {
  Contribution,
  OfficialLayer,
  Report,
  User,
  type UserAttributes,
} from "../models/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate, validatedParams, validatedQuery } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { pageMeta, sendData } from "../utils/respond.js";
import { toPublicUser } from "../services/serialize.js";
import { summarize } from "../services/geometry.js";
import { record } from "../services/moderation-log.js";
import { revokeAllUserTokens } from "../services/tokens.js";

export const adminRouter: Router = Router();

adminRouter.use(requireAuth, requireRole("admin"));

/* --- Comptes ---------------------------------------------------------- */
adminRouter.get(
  "/users",
  validate(listUsersQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, role, status, page, limit } = validatedQuery(req, listUsersQuerySchema);

    const filter: FilterQuery<UserAttributes> = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ displayName: pattern }, { email: pattern }, { organization: pattern }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    sendData(
      res,
      // L'administration voit l'adresse e-mail, contrairement au profil public.
      users.map((user) => ({ ...toPublicUser(user), email: user.email, status: user.status })),
      pageMeta(page, limit, total),
    );
  }),
);

adminRouter.patch(
  "/users/:id/role",
  validate(idParamSchema, "params"),
  validate(changeRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, idParamSchema);
    const { role } = req.body as ReturnType<typeof changeRoleSchema.parse>;
    const actorId = req.auth?.userId as string;

    if (id === actorId) {
      throw ApiError.badRequest(
        "Vous ne pouvez pas modifier votre propre rôle. Demandez à un autre administrateur.",
      );
    }

    const user = await User.findById(id);
    if (!user) throw ApiError.notFound("Ce compte n'existe pas.");

    const previous = user.role;
    if (previous === role) {
      throw ApiError.conflict(`Ce compte a déjà le rôle « ${role} ».`);
    }

    user.role = role;
    await user.save();

    // Le rôle est relu en base à chaque requête, mais révoquer les sessions
    // force une reconnexion propre après un changement de droits.
    await revokeAllUserTokens(user._id);
    await record(actorId, "role_change", "User", user._id, `${previous} → ${role}`, {
      displayName: user.displayName,
      previousRole: previous,
      role,
    });

    sendData(res, { ...toPublicUser(user), email: user.email, status: user.status });
  }),
);

adminRouter.patch(
  "/users/:id/status",
  validate(idParamSchema, "params"),
  validate(changeStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, idParamSchema);
    const { status, reason } = req.body as ReturnType<typeof changeStatusSchema.parse>;
    const actorId = req.auth?.userId as string;

    if (id === actorId) {
      throw ApiError.badRequest("Vous ne pouvez pas suspendre votre propre compte.");
    }

    const user = await User.findById(id);
    if (!user) throw ApiError.notFound("Ce compte n'existe pas.");

    user.status = status;
    await user.save();

    if (status === "suspended") {
      await revokeAllUserTokens(user._id);
      await record(actorId, "suspend_user", "User", user._id, reason ?? null, {
        displayName: user.displayName,
        email: user.email,
      });
    }

    sendData(
      res,
      { ...toPublicUser(user), email: user.email, status: user.status },
      {
        message:
          status === "suspended"
            ? "Le compte est suspendu : ses sessions sont fermées et ses contributions publiées restent visibles."
            : "Le compte est réactivé.",
      },
    );
  }),
);

/* --- Statistiques ----------------------------------------------------- */
adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const weekFloor = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

    const [
      userTotal,
      usersByRole,
      usersByStatus,
      contributionTotal,
      byVisibility,
      byKind,
      openReports,
      oldestPending,
      uploadsPerWeek,
      storage,
      officialLayers,
      contributedLayers,
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Contribution.countDocuments(),
      Contribution.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$visibility", count: { $sum: 1 } } },
      ]),
      Contribution.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$kind", count: { $sum: 1 } } },
      ]),
      Report.countDocuments({ status: "open" }),
      Contribution.findOne({ visibility: "pending" }).sort({ updatedAt: 1 }).select("updatedAt").lean(),
      // Dépôts par semaine ISO sur les douze dernières semaines.
      Contribution.aggregate<{ _id: { year: number; week: number }; count: number }>([
        { $match: { createdAt: { $gte: weekFloor } } },
        {
          $group: {
            _id: { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
      ]),
      Contribution.aggregate<{
        _id: null;
        mediaBytes: number;
        sourceFileBytes: number;
        geometryFeatures: number;
      }>([
        {
          $group: {
            _id: null,
            mediaBytes: { $sum: { $ifNull: ["$media.bytes", 0] } },
            sourceFileBytes: { $sum: { $ifNull: ["$layer.sourceFile.bytes", 0] } },
            geometryFeatures: { $sum: { $ifNull: ["$layer.featureCount", 0] } },
          },
        },
      ]),
      OfficialLayer.countDocuments(),
      Contribution.countDocuments({ kind: "layer", visibility: "public" }),
    ]);

    const totals = storage[0];

    sendData(res, {
      users: {
        total: userTotal,
        active: usersByStatus.find((entry) => entry._id === "active")?.count ?? 0,
        suspended: usersByStatus.find((entry) => entry._id === "suspended")?.count ?? 0,
        byRole: Object.fromEntries(usersByRole.map((entry) => [entry._id, entry.count])),
      },
      contributions: {
        total: contributionTotal,
        byVisibility: Object.fromEntries(byVisibility.map((entry) => [entry._id, entry.count])),
        byKind: Object.fromEntries(byKind.map((entry) => [entry._id, entry.count])),
      },
      queue: {
        pending: byVisibility.find((entry) => entry._id === "pending")?.count ?? 0,
        openReports,
        oldestPendingAt: oldestPending?.updatedAt
          ? new Date(oldestPending.updatedAt).toISOString()
          : null,
      },
      uploadsPerWeek: uploadsPerWeek.map((entry) => ({
        week: `${entry._id.year}-S${String(entry._id.week).padStart(2, "0")}`,
        count: entry.count,
      })),
      storage: {
        mediaBytes: totals?.mediaBytes ?? 0,
        sourceFileBytes: totals?.sourceFileBytes ?? 0,
        // La géométrie vit en base : on en rend compte en nombre d'entités.
        geometryBytes: totals?.geometryFeatures ?? 0,
      },
      layers: { official: officialLayers, contributed: contributedLayers },
    });
  }),
);

/* --- Catalogue officiel ----------------------------------------------- */
adminRouter.post(
  "/layers",
  validate(createLayerSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof createLayerSchema.parse>;

    const existing = await OfficialLayer.findOne({ layerId: input.layerId }).select("_id").lean();
    if (existing) {
      throw ApiError.conflict(
        `Une couche porte déjà l'identifiant « ${input.layerId} ». Choisissez-en un autre.`,
      );
    }

    const stats = summarize(input.geojson);
    const layer = await OfficialLayer.create({
      ...input,
      official: true,
      featureCount: stats.featureCount,
      bbox: stats.bbox ?? [],
      updatedBy: req.auth?.userId,
    });

    sendData(
      res,
      { layerId: layer.layerId, featureCount: layer.featureCount },
      { message: `« ${layer.name} » est ajoutée au catalogue officiel.` },
      201,
    );
  }),
);

adminRouter.patch(
  "/layers/:layerId",
  validate(layerIdParamSchema, "params"),
  validate(updateLayerSchema),
  asyncHandler(async (req, res) => {
    const { layerId } = validatedParams(req, layerIdParamSchema);
    const changes = req.body as ReturnType<typeof updateLayerSchema.parse>;

    const layer = await OfficialLayer.findOne({ layerId });
    if (!layer) throw ApiError.notFound(`La couche « ${layerId} » n'existe pas.`);

    if (changes.geojson) {
      const stats = summarize(changes.geojson);
      layer.geojson = changes.geojson;
      layer.featureCount = stats.featureCount;
      layer.bbox = stats.bbox ?? [];
    }
    for (const key of [
      "name",
      "group",
      "type",
      "color",
      "fillOpacity",
      "weight",
      "defaultVisible",
      "order",
      "source",
    ] as const) {
      const value = changes[key];
      if (value !== undefined) {
        // Chaque clé est contrôlée par le schéma zod en amont.
        (layer as unknown as Record<string, unknown>)[key] = value;
      }
    }
    layer.updatedBy = req.auth?.userId as never;
    await layer.save();

    sendData(
      res,
      { layerId: layer.layerId, featureCount: layer.featureCount },
      { message: `« ${layer.name} » est mise à jour.` },
    );
  }),
);

adminRouter.delete(
  "/layers/:layerId",
  validate(layerIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { layerId } = validatedParams(req, layerIdParamSchema);
    const actorId = req.auth?.userId as string;

    if (layerId === "boundary") {
      throw ApiError.badRequest(
        "La limite officielle ne peut pas être supprimée : elle sert de référence à la superficie, " +
          "à l'emprise de la carte et au contrôle des dépôts.",
      );
    }

    const layer = await OfficialLayer.findOneAndDelete({ layerId });
    if (!layer) throw ApiError.notFound(`La couche « ${layerId} » n'existe pas.`);

    await record(actorId, "delete", "OfficialLayer", layer._id, null, {
      layerId: layer.layerId,
      name: layer.name,
      featureCount: layer.featureCount,
    });

    sendData(res, { deleted: true }, { message: `« ${layer.name} » est retirée du catalogue.` });
  }),
);
