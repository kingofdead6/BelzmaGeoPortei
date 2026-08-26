import { createHash } from "node:crypto";
import { Router } from "express";
import type { Response } from "express";
import { layerIdParamSchema, PARK_CREATED_YEAR, PARK_MAB_YEAR, type ContributedLayer } from "@belezma/shared";
import { Contribution, OfficialLayer, Species } from "../models/index.js";
import { validate, validatedParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { sendData } from "../utils/respond.js";
import { toOfficialLayer } from "../services/serialize.js";
import { areaHectares, perimeterKilometres } from "../services/geometry.js";
import type { FeatureCollection } from "@belezma/shared";

export const layersRouter: Router = Router();

/** Catalogue officiel — métadonnées seules, sans géométrie (§5). */
layersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const layers = await OfficialLayer.find().sort({ order: 1 }).lean();
    sendData(res, layers.map(toOfficialLayer), { count: layers.length });
  }),
);

/**
 * Chiffres-clés du parc. La superficie et le périmètre sont recalculés à
 * partir de la géométrie de la limite officielle, jamais codés en dur (§13).
 */
layersRouter.get(
  "/park-stats",
  asyncHandler(async (_req, res) => {
    const boundary = await OfficialLayer.findOne({ layerId: "boundary" }).select("+geojson").lean();
    if (!boundary) {
      throw ApiError.notFound("La limite officielle du parc n'est pas encore chargée. Lancez `npm run seed`.");
    }

    const collection = boundary.geojson as FeatureCollection;
    const [layerCount, speciesCount] = await Promise.all([
      OfficialLayer.countDocuments(),
      Species.countDocuments(),
    ]);

    const hectares = areaHectares(collection);

    sendData(res, {
      areaHa: Number(hectares.toFixed(1)),
      areaKm2: Number((hectares / 100).toFixed(1)),
      perimeterKm: Number(perimeterKilometres(collection).toFixed(1)),
      bbox: boundary.bbox,
      layerCount,
      speciesCount,
      createdYear: PARK_CREATED_YEAR,
      mabYear: PARK_MAB_YEAR,
    });
  }),
);

/** Couches issues de contributions publiées, présentées comme des entrées de catalogue. */
layersRouter.get(
  "/contributed",
  asyncHandler(async (_req, res) => {
    const contributions = await Contribution.find({ kind: "layer", visibility: "public" })
      .select("title layer publishedAt owner")
      .populate<{ owner: { _id: unknown; displayName: string } }>("owner", "displayName")
      .sort({ publishedAt: -1 })
      .lean();

    const layers: ContributedLayer[] = contributions.flatMap((contribution) => {
      const layer = contribution.layer;
      if (!layer) return [];
      const types = layer.geometryTypes;
      const type = types.every((value) => value.includes("Polygon"))
        ? ("polygon" as const)
        : types.every((value) => value.includes("LineString"))
          ? ("line" as const)
          : types.every((value) => value.includes("Point"))
            ? ("point" as const)
            : ("mixed" as const);

      return [
        {
          layerId: `contribution:${String(contribution._id)}`,
          contributionId: String(contribution._id),
          name: contribution.title,
          group: "Contributions" as const,
          type,
          color: layer.style.color,
          fillOpacity: layer.style.fillOpacity,
          weight: layer.style.weight,
          defaultVisible: false as const,
          official: false as const,
          featureCount: layer.featureCount,
          bbox:
            layer.bbox.length === 4
              ? ([layer.bbox[0], layer.bbox[1], layer.bbox[2], layer.bbox[3]] as [
                  number,
                  number,
                  number,
                  number,
                ])
              : null,
          owner: {
            id: String(contribution.owner._id),
            displayName: contribution.owner.displayName,
          },
          publishedAt: contribution.publishedAt ? new Date(contribution.publishedAt).toISOString() : null,
        },
      ];
    });

    sendData(res, layers, { count: layers.length });
  }),
);

/** Géométrie d'une couche contribuée publiée. */
layersRouter.get(
  "/contributed/:layerId/geojson",
  validate(layerIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { layerId } = validatedParams(req, layerIdParamSchema);

    const contribution = await Contribution.findOne({
      _id: layerId,
      kind: "layer",
      visibility: "public",
    })
      .select("layer.geojson updatedAt")
      .lean()
      .catch(() => null);

    if (!contribution?.layer) {
      throw ApiError.notFound("Cette couche contribuée n'est pas publiée.");
    }

    sendGeoJson(res, contribution.layer.geojson, `contribution-${layerId}`, contribution.updatedAt);
  }),
);

/**
 * Géométrie d'une couche officielle — mise en cache un jour et validée par
 * ETag, la géométrie ne changeant qu'au réimport (§5).
 */
layersRouter.get(
  "/:layerId/geojson",
  validate(layerIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { layerId } = validatedParams(req, layerIdParamSchema);

    const layer = await OfficialLayer.findOne({ layerId }).select("+geojson updatedAt").lean();
    if (!layer) {
      throw ApiError.notFound(`La couche « ${layerId} » n'existe pas dans le catalogue officiel.`);
    }

    sendGeoJson(res, layer.geojson, layerId, layer.updatedAt);
  }),
);

function sendGeoJson(
  res: Response,
  geojson: unknown,
  key: string,
  updatedAt: Date | undefined,
): void {
  const payload = JSON.stringify(geojson);
  const etag = `"${createHash("sha1").update(`${key}:${updatedAt?.getTime() ?? 0}:${payload.length}`).digest("hex")}"`;

  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("ETag", etag);

  if (res.req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(`{"data":${payload}}`);
}
