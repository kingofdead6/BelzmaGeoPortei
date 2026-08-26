import type { FilterQuery, SortOrder } from "mongoose";
import type { ListContributionsQuery } from "@belezma/shared";
import type { ContributionAttributes } from "../models/index.js";

/**
 * Traduit les filtres publics en requête Mongo. La visibilité est imposée par
 * l'appelant, jamais par la requête HTTP.
 */
export function buildPublicFilter(
  query: Pick<ListContributionsQuery, "kind" | "tags" | "q" | "bbox" | "near" | "radius">,
): FilterQuery<ContributionAttributes> {
  const filter: FilterQuery<ContributionAttributes> = { visibility: "public" };

  if (query.kind) filter.kind = query.kind;
  if (query.tags?.length) filter.tags = { $all: query.tags };
  if (query.q) filter.$text = { $search: query.q };

  if (query.near) {
    const [lng, lat] = query.near;
    filter.location = {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: query.radius ?? 5_000,
      },
    };
  } else if (query.bbox) {
    const [minLng, minLat, maxLng, maxLat] = query.bbox;
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

  return filter;
}

export function buildSort(
  sort: ListContributionsQuery["sort"],
  hasTextSearch: boolean,
): Record<string, SortOrder | { $meta: string }> {
  if (hasTextSearch) return { score: { $meta: "textScore" }, publishedAt: -1 };
  switch (sort) {
    case "oldest":
      return { publishedAt: 1, createdAt: 1 };
    case "popular":
      return { viewCount: -1, publishedAt: -1 };
    default:
      return { publishedAt: -1, createdAt: -1 };
  }
}
