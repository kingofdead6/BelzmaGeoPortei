import shp from "shpjs";
import { featureCollectionSchema, type FeatureCollection } from "@belezma/shared";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** Signature ZIP : « PK\x03\x04 », ou les variantes vide et fragmentée. */
function isZip(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const [a, b, c, d] = [buffer[0], buffer[1], buffer[2], buffer[3]];
  return (
    a === 0x50 &&
    b === 0x4b &&
    (c === 0x03 || c === 0x05 || c === 0x07) &&
    (d === 0x04 || d === 0x06 || d === 0x08)
  );
}

/**
 * Convertit une archive shapefile en GeoJSON. `shpjs` accepte l'archive
 * complète (.shp/.dbf/.prj/.shx) et renvoie soit une collection, soit un
 * tableau de collections quand l'archive contient plusieurs couches.
 */
export async function shapefileToGeoJson(
  buffer: Buffer,
  originalName: string,
): Promise<FeatureCollection> {
  if (!isZip(buffer)) {
    throw ApiError.unsupportedMediaType(
      `« ${originalName} » n'est pas une archive ZIP. Compressez ensemble les fichiers ` +
        ".shp, .dbf, .shx et .prj de votre couche, puis déposez l'archive obtenue.",
    );
  }

  let converted: unknown;
  try {
    converted = await shp(buffer as unknown as ArrayBuffer);
  } catch (error) {
    logger.warn({ err: error, originalName }, "Conversion shapefile impossible");
    const detail = error instanceof Error ? error.message : "";
    throw ApiError.badRequest(
      "Cette archive n'a pas pu être lue comme un shapefile. Vérifiez qu'elle contient bien un " +
        "fichier .shp accompagné de ses fichiers .dbf et .shx, sans dossier intermédiaire." +
        (detail ? ` (${detail})` : ""),
    );
  }

  // Une archive multi-couches donne un tableau : on les fusionne en une seule
  // collection, en conservant le nom de couche dans les propriétés.
  const collections = Array.isArray(converted) ? converted : [converted];
  const features = collections.flatMap((collection) => {
    const parsed = featureCollectionSchema.safeParse(collection);
    if (!parsed.success) return [];
    const name = (collection as { fileName?: string }).fileName;
    return parsed.data.features.map((feature) =>
      name ? { ...feature, properties: { couche: name, ...(feature.properties ?? {}) } } : feature,
    );
  });

  if (features.length === 0) {
    throw ApiError.badRequest(
      "Cette archive ne contient aucune entité géométrique exploitable. Vérifiez que le fichier " +
        ".shp est bien présent et non vide.",
    );
  }

  return { type: "FeatureCollection", features };
}

export { isZip };
