import { Router } from "express";
import { mapFeaturesQuerySchema } from "@belezma/shared";
import type { FilterQuery } from "mongoose";
import { Contribution, type ContributionAttributes } from "../models/index.js";
import { validate, validatedQuery } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendData } from "../utils/respond.js";
import { buildImageUrls } from "../services/cloudinary.js";

export const mapRouter: Router = Router();

/**
 * Points publics (photos, observations, sites patrimoniaux) servis en une
 * seule FeatureCollection pour l'affichage groupé sur la carte (§5).
 */
mapRouter.get(
  "/features",
  validate(mapFeaturesQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { bbox, kind, limit } = validatedQuery(req, mapFeaturesQuerySchema);

    const filter: FilterQuery<ContributionAttributes> = {
      visibility: "public",
      location: { $ne: null },
      kind: kind ?? { $in: ["photo", "observation", "heritage"] },
    };

    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      filter.location = {
        $geoWithin: {
          $geometry: {
            type: "Polygon",
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
              ],
            ],
          },
        },
      };
    }

    const items = await Contribution.find(filter)
      .select("kind title location media species heritage publishedAt owner")
      .populate<{ owner: { _id: unknown; displayName: string } }>("owner", "displayName")
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();

    const features = items.flatMap((item) => {
      if (!item.location) return [];
      return [
        {
          type: "Feature" as const,
          id: String(item._id),
          geometry: { type: "Point" as const, coordinates: item.location.coordinates },
          properties: {
            id: String(item._id),
            kind: item.kind,
            title: item.title,
            thumbUrl: item.media ? buildImageUrls(item.media.publicId).thumbUrl : null,
            scientificName: item.species?.scientificName ?? null,
            commonName: item.species?.commonName ?? null,
            iucnStatus: item.species?.iucnStatus ?? null,
            category: item.heritage?.category ?? null,
            author: item.owner.displayName,
            publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
          },
        },
      ];
    });

    sendData(
      res,
      { type: "FeatureCollection" as const, features },
      { count: features.length, truncated: features.length === limit },
    );
  }),
);
