import { z } from "zod";

/**
 * Schémas GeoJSON (RFC 7946) — utilisés pour valider les imports d'utilisateurs
 * et les couches officielles. Volontairement stricts sur l'ordre [lng, lat].
 */

export const positionSchema = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .rest(z.number());

export type Position = z.infer<typeof positionSchema>;

const linearRingSchema = z
  .array(positionSchema)
  .min(4, "Un anneau doit contenir au moins quatre positions.")
  .refine(
    (ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      return !!first && !!last && first[0] === last[0] && first[1] === last[1];
    },
    { message: "Un anneau polygonal doit être fermé : la dernière position doit répéter la première." },
  );

export const pointSchema = z.object({ type: z.literal("Point"), coordinates: positionSchema });
export const multiPointSchema = z.object({ type: z.literal("MultiPoint"), coordinates: z.array(positionSchema) });
export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(positionSchema).min(2, "Une ligne doit contenir au moins deux positions."),
});
export const multiLineStringSchema = z.object({
  type: z.literal("MultiLineString"),
  coordinates: z.array(z.array(positionSchema).min(2)),
});
export const polygonSchema = z.object({ type: z.literal("Polygon"), coordinates: z.array(linearRingSchema) });
export const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(linearRingSchema)),
});

const simpleGeometrySchema = z.discriminatedUnion("type", [
  pointSchema,
  multiPointSchema,
  lineStringSchema,
  multiLineStringSchema,
  polygonSchema,
  multiPolygonSchema,
]);

export const geometryCollectionSchema = z.object({
  type: z.literal("GeometryCollection"),
  geometries: z.array(simpleGeometrySchema),
});

export const geometrySchema = z.union([simpleGeometrySchema, geometryCollectionSchema]);
export type Geometry = z.infer<typeof geometrySchema>;

export const GEOMETRY_TYPES = [
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
] as const;
export type GeometryType = (typeof GEOMETRY_TYPES)[number];

export const featureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: geometrySchema.nullable(),
  properties: z.record(z.unknown()).nullable().default({}),
  bbox: z.array(z.number()).optional(),
});
export type Feature = z.infer<typeof featureSchema>;

export const featureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(featureSchema),
  bbox: z.array(z.number()).optional(),
});
export type FeatureCollection = z.infer<typeof featureCollectionSchema>;

/** Point GeoJSON stocké dans MongoDB (index 2dsphere). */
export const geoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: positionSchema,
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = z.infer<typeof bboxSchema>;

/** `bbox=minLng,minLat,maxLng,maxLat` en paramètre de requête. */
export const bboxQuerySchema = z
  .string()
  .transform((value, ctx) => {
    const parts = value.split(",").map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Emprise attendue au format minLng,minLat,maxLng,maxLat.",
      });
      return z.NEVER;
    }
    const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
    if (minLng > maxLng || minLat > maxLat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Emprise invalide : le coin sud-ouest doit précéder le coin nord-est.",
      });
      return z.NEVER;
    }
    return [minLng, minLat, maxLng, maxLat] as BBox;
  });

/** Parcourt toutes les positions d'une géométrie, quelle que soit sa profondeur. */
export function forEachPosition(geometry: Geometry | null, visit: (position: Position) => void): void {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) forEachPosition(child, visit);
    return;
  }
  const depthByType: Record<string, number> = {
    Point: 0,
    MultiPoint: 1,
    LineString: 1,
    MultiLineString: 2,
    Polygon: 2,
    MultiPolygon: 3,
  };
  const depth = depthByType[geometry.type];
  if (depth === undefined) return;

  const recurse = (coordinates: unknown, remaining: number): void => {
    if (remaining === 0) {
      visit(coordinates as Position);
      return;
    }
    if (!Array.isArray(coordinates)) return;
    for (const child of coordinates) recurse(child, remaining - 1);
  };
  recurse(geometry.coordinates, depth);
}

/** Emprise d'une FeatureCollection, ou `null` si elle ne contient aucune position. */
export function computeBbox(collection: FeatureCollection): BBox | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let seen = false;

  for (const feature of collection.features) {
    forEachPosition(feature.geometry, ([lng, lat]) => {
      seen = true;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
  }
  return seen ? [minLng, minLat, maxLng, maxLat] : null;
}

/** Types de géométrie distincts présents dans une FeatureCollection. */
export function collectGeometryTypes(collection: FeatureCollection): GeometryType[] {
  const types = new Set<GeometryType>();
  for (const feature of collection.features) {
    if (feature.geometry) types.add(feature.geometry.type);
  }
  return [...types].sort();
}

/** Vrai si les deux emprises se recoupent. */
export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
