import { area, bbox as turfBbox, booleanPointInPolygon, centroid, length, point } from "@turf/turf";
import type { Feature as TurfFeature, Polygon, MultiPolygon } from "geojson";
import {
  collectGeometryTypes,
  computeBbox,
  featureCollectionSchema,
  UPLOAD_LIMITS,
  type BBox,
  type FeatureCollection,
} from "@belezma/shared";
import { ApiError } from "../utils/errors.js";

export interface GeometrySummary {
  featureCount: number;
  geometryTypes: string[];
  bbox: BBox | null;
  centroid: [number, number] | null;
}

/**
 * Analyse une FeatureCollection déjà validée : nombre d'entités, types de
 * géométrie, emprise et centroïde.
 */
export function summarize(collection: FeatureCollection): GeometrySummary {
  const box = computeBbox(collection);
  let center: [number, number] | null = null;

  if (box) {
    try {
      const result = centroid(collection as never);
      const [lng, lat] = result.geometry.coordinates;
      if (typeof lng === "number" && typeof lat === "number") center = [lng, lat];
    } catch {
      // Un centroïde indéfini (collection vide, géométries dégénérées) n'est
      // pas bloquant : on retombe sur le centre de l'emprise.
      center = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    }
  }

  return {
    featureCount: collection.features.length,
    geometryTypes: collectGeometryTypes(collection),
    bbox: box,
    centroid: center,
  };
}

/** Superficie en hectares, calculée sur l'ellipsoïde (jamais codée en dur, §13). */
export function areaHectares(collection: FeatureCollection): number {
  return area(collection as never) / 10_000;
}

/** Longueur cumulée en kilomètres des géométries linéaires. */
export function lengthKilometres(collection: FeatureCollection): number {
  return length(collection as never, { units: "kilometers" });
}

/**
 * Périmètre en kilomètres : `turf.length` ignore les polygones, on convertit
 * donc chaque anneau en ligne avant de mesurer.
 */
export function perimeterKilometres(collection: FeatureCollection): number {
  const rings: FeatureCollection = {
    type: "FeatureCollection",
    features: collection.features.flatMap((feature) => {
      const geometry = feature.geometry;
      if (!geometry) return [];
      const polygons =
        geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.type === "MultiPolygon"
            ? geometry.coordinates
            : [];
      return polygons.flatMap((polygon) =>
        polygon.map((ring) => ({
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: ring },
          properties: {},
        })),
      );
    }),
  };
  return rings.features.length === 0 ? 0 : length(rings as never, { units: "kilometers" });
}

/**
 * Valide un GeoJSON déposé par un utilisateur. Les messages nomment le
 * problème et l'action à mener (§10).
 */
export function parseUploadedGeoJson(raw: unknown): FeatureCollection {
  if (raw === null || typeof raw !== "object") {
    throw ApiError.badRequest(
      "Ce fichier n'est pas un GeoJSON : le contenu attendu est un objet JSON de type FeatureCollection.",
    );
  }

  // Une géométrie seule ou une entité seule est acceptée et enveloppée.
  const candidate = normalizeToCollection(raw as Record<string, unknown>);

  const parsed = featureCollectionSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw ApiError.badRequest(
      first
        ? `Ce GeoJSON est invalide — ${first.message} (${first.path.join(".") || "racine"}).`
        : "Ce GeoJSON est invalide.",
      parsed.error.issues.slice(0, 10).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  const collection = parsed.data;

  if (collection.features.length === 0) {
    throw ApiError.badRequest(
      "Ce fichier ne contient aucune entité. Vérifiez l'export depuis votre logiciel SIG avant de le redéposer.",
    );
  }

  if (collection.features.length > UPLOAD_LIMITS.maxFeatures) {
    throw ApiError.badRequest(
      `Ce fichier GeoJSON contient ${collection.features.length.toLocaleString("fr-FR")} entités — la limite est de ` +
        `${UPLOAD_LIMITS.maxFeatures.toLocaleString("fr-FR")}. Simplifiez la géométrie avant l'import.`,
    );
  }

  if (collection.features.every((feature) => feature.geometry === null)) {
    throw ApiError.badRequest(
      "Aucune entité de ce fichier ne porte de géométrie : seules les tables attributaires ont été exportées.",
    );
  }

  return collection;
}

function normalizeToCollection(raw: Record<string, unknown>): unknown {
  if (raw.type === "FeatureCollection") return raw;
  if (raw.type === "Feature") {
    return { type: "FeatureCollection", features: [raw] };
  }
  if (typeof raw.type === "string") {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: raw, properties: {} }],
    };
  }
  return raw;
}

/** Vrai si l'emprise déposée recoupe celle du parc. */
export function intersectsPark(candidate: BBox, park: BBox): boolean {
  return candidate[0] <= park[2] && candidate[2] >= park[0] && candidate[1] <= park[3] && candidate[3] >= park[1];
}

/** Vrai si le point tombe à l'intérieur de la limite officielle du parc. */
export function isInsideBoundary(
  lng: number,
  lat: number,
  boundary: FeatureCollection,
): boolean {
  return boundary.features.some((feature) => {
    const geometry = feature.geometry;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return false;
    return booleanPointInPolygon(
      point([lng, lat]),
      { type: "Feature", geometry, properties: {} } as TurfFeature<Polygon | MultiPolygon>,
    );
  });
}

export function boundingBoxOf(collection: FeatureCollection): BBox | null {
  if (collection.features.length === 0) return null;
  const box = turfBbox(collection as never);
  const [minLng, minLat, maxLng, maxLat] = box;
  if (
    typeof minLng !== "number" ||
    typeof minLat !== "number" ||
    typeof maxLng !== "number" ||
    typeof maxLat !== "number"
  ) {
    return null;
  }
  return [minLng, minLat, maxLng, maxLat];
}
