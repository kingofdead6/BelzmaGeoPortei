import { Router } from "express";
import multer from "multer";
import type { FilterQuery, Types } from "mongoose";
import {
  contributionIdParamSchema,
  createContributionSchema,
  listMineQuerySchema,
  reportContributionSchema,
  updateContributionSchema,
  uploadSignatureSchema,
  UPLOAD_LIMITS,
  type FeatureCollection,
} from "@belezma/shared";
import {
  Contribution,
  OfficialLayer,
  Report,
  User,
  type ContributionAttributes,
} from "../models/index.js";
import { isAtLeast, requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rate-limit.js";
import { validate, validatedParams, validatedQuery } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { pageMeta, sendData } from "../utils/respond.js";
import { toContribution } from "../services/serialize.js";
import {
  destroyAsset,
  signDirectUpload,
  uploadImage,
  uploadRawFile,
} from "../services/cloudinary.js";
import { prepareImage } from "../services/image.js";
import { shapefileToGeoJson } from "../services/shapefile.js";
import {
  boundingBoxOf,
  intersectsPark,
  parseUploadedGeoJson,
  summarize,
} from "../services/geometry.js";
import { assertTransition } from "../services/contribution-lifecycle.js";
import { logger } from "../utils/logger.js";

export const contributionsWriteRouter: Router = Router();

const OWNER_FIELDS = "displayName avatarUrl organization";

const upload = multer({
  storage: multer.memoryStorage(),
  // Le plafond le plus large ; chaque type est ensuite contrôlé précisément.
  limits: { fileSize: UPLOAD_LIMITS.shapefileZipBytes, files: 1 },
});

/* ------------------------------------------------------------------ *
 * Lecture — les contributions du compte connecté, tous états confondus
 * ------------------------------------------------------------------ */
contributionsWriteRouter.get(
  "/mine",
  requireAuth,
  validate(listMineQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { kind, visibility, sort, page, limit } = validatedQuery(req, listMineQuerySchema);
    const userId = req.auth?.userId as string;

    const filter: FilterQuery<ContributionAttributes> = { owner: userId };
    if (kind) filter.kind = kind;
    if (visibility) filter.visibility = visibility;

    const order = sort === "oldest" ? 1 : -1;

    const [items, total, counts] = await Promise.all([
      Contribution.find(filter)
        .populate("owner", OWNER_FIELDS)
        .sort({ createdAt: order })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Contribution.countDocuments(filter),
      // Les compteurs par état alimentent les onglets du tableau de bord.
      Contribution.aggregate<{ _id: string; count: number }>([
        { $match: { owner: asObjectId(userId) } },
        { $group: { _id: "$visibility", count: { $sum: 1 } } },
      ]),
    ]);

    sendData(res, items.map(toContribution), {
      ...pageMeta(page, limit, total),
      counts: Object.fromEntries(counts.map((entry) => [entry._id, entry.count])),
    });
  }),
);

/* ------------------------------------------------------------------ *
 * Création
 * ------------------------------------------------------------------ */
contributionsWriteRouter.post(
  "/",
  requireAuth,
  uploadLimiter,
  upload.single("file"),
  validate(createContributionSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof createContributionSchema.parse>;
    const userId = req.auth?.userId as string;

    const document: Partial<ContributionAttributes> = {
      owner: asObjectId(userId),
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      tags: input.tags,
      // Toute contribution naît privée (§1) ; la publication se demande ensuite.
      visibility: "private",
      location:
        input.lng !== undefined && input.lat !== undefined
          ? { type: "Point", coordinates: [input.lng, input.lat] }
          : null,
    };

    if (input.kind === "photo" || input.kind === "observation") {
      if (!req.file) {
        throw ApiError.badRequest(
          "Aucune image reçue. Déposez une photographie au format JPEG, PNG ou WebP.",
        );
      }
      const prepared = await prepareImage(req.file.buffer, req.file.originalname);
      const uploaded = await uploadImage(prepared.buffer, { userId, kind: input.kind });
      document.media = {
        publicId: uploaded.publicId,
        // Les URL d'affichage sont dérivées du publicId à la lecture (§7) :
        // ces champs ne servent que de repli si Cloudinary est absent.
        url: uploaded.publicId,
        thumbUrl: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        format: uploaded.format,
        takenAt: null,
        exifStripped: prepared.exifStripped,
      };
      if (input.kind === "observation" && input.species) {
        document.species = {
          scientificName: input.species.scientificName,
          commonName: input.species.commonName ?? null,
          iucnStatus: input.species.iucnStatus ?? null,
          group: input.species.group ?? null,
        };
      }
    }

    if (input.kind === "layer") {
      if (!req.file) {
        throw ApiError.badRequest(
          "Aucun fichier reçu. Déposez un fichier .geojson, ou une archive .zip contenant un shapefile.",
        );
      }
      document.layer = await buildLayerFromFile(req.file, userId, input.style);
      // Le centre de l'emprise sert de repère sur la carte à défaut de position.
      if (!document.location && document.layer.bbox.length === 4) {
        const [minLng, minLat, maxLng, maxLat] = document.layer.bbox as [
          number,
          number,
          number,
          number,
        ];
        document.location = {
          type: "Point",
          coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        };
      }
    }

    if (input.kind === "heritage" && input.heritageCategory) {
      document.heritage = { category: input.heritageCategory };
    }

    const created = await Contribution.create(document);

    if (input.requestPublication) {
      created.visibility = "pending";
      await created.save();
    }

    await User.updateOne({ _id: userId }, { $inc: { "stats.contributions": 1 } });
    await created.populate("owner", OWNER_FIELDS);

    sendData(res, toContribution(created), undefined, 201);
  }),
);

/* ------------------------------------------------------------------ *
 * Modification, partage, retrait, suppression
 * ------------------------------------------------------------------ */
contributionsWriteRouter.patch(
  "/:id",
  requireAuth,
  validate(contributionIdParamSchema, "params"),
  validate(updateContributionSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const changes = req.body as ReturnType<typeof updateContributionSchema.parse>;

    const contribution = await loadOwned(id, req.auth?.userId as string);

    if (changes.title !== undefined) contribution.title = changes.title;
    if (changes.description !== undefined) contribution.description = changes.description;
    if (changes.tags !== undefined) contribution.tags = changes.tags;
    if (changes.heritageCategory !== undefined) {
      contribution.heritage = { category: changes.heritageCategory };
    }
    if (changes.species !== undefined) {
      contribution.species = {
        scientificName: changes.species.scientificName,
        commonName: changes.species.commonName ?? null,
        iucnStatus: changes.species.iucnStatus ?? null,
        group: changes.species.group ?? null,
      };
    }
    if (changes.style !== undefined && contribution.layer) {
      contribution.layer.style = { ...contribution.layer.style, ...changes.style };
      contribution.markModified("layer.style");
    }
    if (changes.lng !== undefined) {
      contribution.location =
        changes.lng === null || changes.lat === null || changes.lat === undefined
          ? null
          : { type: "Point", coordinates: [changes.lng, changes.lat] };
    }

    // Modifier une contribution publiée la renvoie en validation (§5) : ce qui
    // a été relu n'est plus ce qui serait affiché.
    const wasPublic = contribution.visibility === "public";
    if (wasPublic) {
      contribution.visibility = "pending";
      contribution.publishedAt = null;
      await User.updateOne({ _id: contribution.owner }, { $inc: { "stats.published": -1 } });
    }

    await contribution.save();
    await contribution.populate("owner", OWNER_FIELDS);

    sendData(res, toContribution(contribution), {
      returnedToReview: wasPublic,
      message: wasPublic
        ? "Votre contribution a été modifiée : elle repasse en validation avant d'être publiée à nouveau."
        : undefined,
    });
  }),
);

contributionsWriteRouter.post(
  "/:id/share",
  requireAuth,
  validate(contributionIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const contribution = await loadOwned(id, req.auth?.userId as string);

    assertTransition(contribution.visibility, "pending");

    if (contribution.kind === "heritage" && !contribution.location) {
      throw ApiError.badRequest("Localisez ce site sur la carte avant d'en demander la publication.");
    }

    const wasPublic = contribution.visibility === "public";
    contribution.visibility = "pending";
    contribution.publishedAt = null;
    contribution.rejectedReason = null;
    await contribution.save();

    if (wasPublic) {
      await User.updateOne({ _id: contribution.owner }, { $inc: { "stats.published": -1 } });
    }
    await contribution.populate("owner", OWNER_FIELDS);

    sendData(res, toContribution(contribution), {
      message: "Votre demande est enregistrée. L'équipe du parc l'examinera prochainement.",
    });
  }),
);

contributionsWriteRouter.post(
  "/:id/unshare",
  requireAuth,
  validate(contributionIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const contribution = await loadOwned(id, req.auth?.userId as string);

    assertTransition(contribution.visibility, "private");

    const wasPublic = contribution.visibility === "public";
    contribution.visibility = "private";
    contribution.publishedAt = null;
    await contribution.save();

    if (wasPublic) {
      await User.updateOne({ _id: contribution.owner }, { $inc: { "stats.published": -1 } });
    }
    await contribution.populate("owner", OWNER_FIELDS);

    sendData(res, toContribution(contribution), {
      message: "Cette contribution est de nouveau privée : vous seul pouvez la consulter.",
    });
  }),
);

contributionsWriteRouter.delete(
  "/:id",
  requireAuth,
  validate(contributionIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const auth = req.auth;
    if (!auth) throw ApiError.unauthenticated();

    const contribution = await Contribution.findById(id);
    if (!contribution) throw ApiError.notFound("Cette contribution n'existe pas.");

    const isOwner = String(contribution.owner) === auth.userId;
    if (!isOwner && !isAtLeast(auth.role, "moderator")) {
      // Un identifiant valide ne doit pas révéler l'existence d'une
      // contribution qui n'appartient pas à l'appelant.
      throw ApiError.notFound("Cette contribution n'existe pas.");
    }

    // Les fichiers Cloudinary partent avec la contribution ; un échec est
    // consigné dans `orphaned_assets` plutôt qu'ignoré (§7).
    if (contribution.media) {
      await destroyAsset(contribution.media.publicId, "image", { contributionId: id });
    }
    if (contribution.layer?.sourceFile?.publicId) {
      await destroyAsset(contribution.layer.sourceFile.publicId, "raw", { contributionId: id });
    }

    await Promise.all([
      contribution.deleteOne(),
      Report.deleteMany({ contribution: contribution._id }),
      User.updateOne(
        { _id: contribution.owner },
        {
          $inc: {
            "stats.contributions": -1,
            ...(contribution.visibility === "public" ? { "stats.published": -1 } : {}),
          },
        },
      ),
    ]);

    logger.info({ contributionId: id, actor: auth.userId }, "Contribution supprimée");
    sendData(res, { deleted: true });
  }),
);

/* ------------------------------------------------------------------ *
 * Signalement
 * ------------------------------------------------------------------ */
contributionsWriteRouter.post(
  "/:id/report",
  requireAuth,
  validate(contributionIdParamSchema, "params"),
  validate(reportContributionSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const { reason, note } = req.body as ReturnType<typeof reportContributionSchema.parse>;
    const userId = req.auth?.userId as string;

    const contribution = await Contribution.findById(id).select("visibility owner").lean();
    if (!contribution || contribution.visibility !== "public") {
      throw ApiError.notFound("Cette contribution n'existe pas ou n'est pas publiée.");
    }
    if (String(contribution.owner) === userId) {
      throw ApiError.badRequest("Vous ne pouvez pas signaler votre propre contribution.");
    }

    const existing = await Report.findOne({ contribution: id, reporter: userId }).lean();
    if (existing) {
      throw ApiError.conflict("Vous avez déjà signalé cette contribution.");
    }

    await Report.create({ contribution: id, reporter: userId, reason, note: note ?? null });
    await Contribution.updateOne({ _id: id }, { $inc: { flagCount: 1 } });

    sendData(
      res,
      { reported: true },
      { message: "Votre signalement est transmis à l'équipe du parc. Merci." },
      201,
    );
  }),
);

/* ------------------------------------------------------------------ *
 * Signature d'envoi direct navigateur → Cloudinary (§7)
 * ------------------------------------------------------------------ */
export const uploadsRouter: Router = Router();

uploadsRouter.post(
  "/signature",
  requireAuth,
  uploadLimiter,
  validate(uploadSignatureSchema),
  asyncHandler(async (req, res) => {
    const { kind } = req.body as ReturnType<typeof uploadSignatureSchema.parse>;
    sendData(res, signDirectUpload({ userId: req.auth?.userId as string, kind }));
  }),
);

/* ------------------------------------------------------------------ *
 * Utilitaires
 * ------------------------------------------------------------------ */

/** Charge une contribution du compte appelant, ou refuse sans en révéler l'existence. */
async function loadOwned(id: string, userId: string) {
  const contribution = await Contribution.findById(id);
  if (!contribution || String(contribution.owner) !== userId) {
    throw ApiError.notFound("Cette contribution n'existe pas.");
  }
  return contribution;
}

/** Le format a déjà été validé par `objectIdSchema` en amont de la route. */
function asObjectId(value: string): Types.ObjectId {
  return value as unknown as Types.ObjectId;
}

async function buildLayerFromFile(
  file: Express.Multer.File,
  userId: string,
  style: { color: string; fillOpacity: number; weight: number } | undefined,
) {
  const name = file.originalname.toLowerCase();
  const isArchive = name.endsWith(".zip");

  const limit = isArchive ? UPLOAD_LIMITS.shapefileZipBytes : UPLOAD_LIMITS.geojsonBytes;
  if (file.size > limit) {
    throw ApiError.payloadTooLarge(
      `Ce fichier pèse ${(file.size / (1024 * 1024)).toFixed(1)} Mo — la limite est de ` +
        `${limit / (1024 * 1024)} Mo pour ${isArchive ? "une archive shapefile" : "un GeoJSON"}.`,
    );
  }

  let collection: FeatureCollection;
  if (isArchive) {
    collection = await shapefileToGeoJson(file.buffer, file.originalname);
    // Le plafond d'entités s'applique aussi après conversion.
    if (collection.features.length > UPLOAD_LIMITS.maxFeatures) {
      throw ApiError.badRequest(
        `Ce shapefile contient ${collection.features.length.toLocaleString("fr-FR")} entités — la ` +
          `limite est de ${UPLOAD_LIMITS.maxFeatures.toLocaleString("fr-FR")}. Simplifiez la ` +
          "géométrie avant l'import.",
      );
    }
  } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString("utf8"));
    } catch {
      throw ApiError.badRequest(
        `« ${file.originalname} » n'est pas un JSON valide. Réexportez la couche depuis votre logiciel SIG.`,
      );
    }
    collection = parseUploadedGeoJson(parsed);
  } else {
    throw ApiError.unsupportedMediaType(
      `Le format de « ${file.originalname} » n'est pas pris en charge. Déposez un fichier ` +
        ".geojson, .json, ou une archive .zip contenant un shapefile.",
    );
  }

  const stats = summarize(collection);
  const bbox = boundingBoxOf(collection);

  // Emprise hors parc : on l'enregistre et on le signale, sans refuser — une
  // couche limitrophe peut légitimement déborder (§7).
  let withinPark = false;
  const boundary = await OfficialLayer.findOne({ layerId: "boundary" }).select("bbox").lean();
  if (bbox && boundary?.bbox.length === 4) {
    withinPark = intersectsPark(bbox, boundary.bbox as [number, number, number, number]);
  }

  const archived = await uploadRawFile(file.buffer, {
    userId,
    filename: file.originalname,
  }).catch((error: unknown) => {
    // L'archivage du fichier source n'est pas indispensable : la géométrie est
    // déjà en base. On poursuit sans lui plutôt que de perdre le dépôt.
    logger.warn(
      { err: error, originalName: file.originalname },
      "Archivage du fichier source ignoré",
    );
    return null;
  });

  return {
    geojson: collection,
    featureCount: stats.featureCount,
    geometryTypes: stats.geometryTypes,
    bbox: bbox ?? [],
    withinPark,
    style: style ?? { color: "#B8912C", fillOpacity: 0.35, weight: 2 },
    sourceFile: {
      publicId: archived?.publicId ?? null,
      url: archived?.url ?? null,
      originalName: file.originalname,
      bytes: file.size,
      format: isArchive ? "zip" : "geojson",
    },
  };
}
