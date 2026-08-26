import { describe, expect, it } from "vitest";
import {
  areaHectares,
  boundingBoxOf,
  isInsideBoundary,
  parseUploadedGeoJson,
  perimeterKilometres,
  summarize,
} from "../src/services/geometry.js";
import { availableGeojsonIds, catalog, geojson, speciesFile } from "../src/seed/load-seed-files.js";
import { PARK_AREA_REFERENCE_HA, PARK_PERIMETER_REFERENCE_KM, UPLOAD_LIMITS } from "@belezma/shared";
import { ApiError } from "../src/utils/errors.js";

const boundary = geojson("boundary");

describe("Données extraites du prototype", () => {
  it("fournit la limite officielle et les 19 couches SIG", () => {
    const ids = availableGeojsonIds();
    expect(ids).toContain("boundary");
    expect(ids).toHaveLength(20);
  });

  it("décrit chaque couche du catalogue avec une couleur hexadécimale", () => {
    for (const entry of catalog()) {
      expect(entry.color, entry.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(entry.fillOpacity, entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.fillOpacity, entry.id).toBeLessThanOrEqual(1);
    }
  });

  it("compte 470 fiches d'espèces réparties en 10 jeux de données", () => {
    const file = speciesFile();
    expect(file.datasets).toHaveLength(10);
    const total = file.datasets.reduce((sum, dataset) => sum + dataset.records.length, 0);
    expect(total).toBe(470);
  });

  it("n'émet que des FeatureCollection valides", () => {
    for (const id of availableGeojsonIds()) {
      const collection = geojson(id);
      expect(collection, id).not.toBeNull();
      expect(collection?.type, id).toBe("FeatureCollection");
      expect(collection?.features.length, id).toBeGreaterThan(0);
    }
  });
});

describe("Superficie du parc calculée depuis la géométrie", () => {
  it("retrouve la superficie portée par la source à moins de 2 % près", () => {
    expect(boundary).not.toBeNull();
    const hectares = areaHectares(boundary!);
    const gap = Math.abs(hectares - PARK_AREA_REFERENCE_HA) / PARK_AREA_REFERENCE_HA;
    expect(gap).toBeLessThan(0.02);
  });

  it("retrouve le périmètre porté par la source à moins de 5 % près", () => {
    const kilometres = perimeterKilometres(boundary!);
    const gap = Math.abs(kilometres - PARK_PERIMETER_REFERENCE_KM) / PARK_PERIMETER_REFERENCE_KM;
    expect(gap).toBeLessThan(0.05);
  });

  it("situe l'emprise sur le massif du Belezma", () => {
    const box = boundingBoxOf(boundary!);
    expect(box).not.toBeNull();
    const [minLng, minLat, maxLng, maxLat] = box!;
    expect(minLng).toBeGreaterThan(5.8);
    expect(maxLng).toBeLessThan(6.4);
    expect(minLat).toBeGreaterThan(35.4);
    expect(maxLat).toBeLessThan(35.8);
  });

  it("reconnaît un point intérieur et un point extérieur au parc", () => {
    // Poste de vigie de Tarbaat, entité réelle de la couche `poste_vigie`.
    expect(isInsideBoundary(5.9915, 35.5881, boundary!)).toBe(true);
    // Centre-ville de Batna, hors limite.
    expect(isInsideBoundary(6.1741, 35.5559, boundary!)).toBe(false);
  });
});

describe("Analyse d'une couche", () => {
  it("résume la cédraie avec ses types de géométrie", () => {
    const summary = summarize(geojson("cedraie")!);
    expect(summary.featureCount).toBe(64);
    expect(summary.geometryTypes).toEqual(["MultiPolygon", "Polygon"]);
    expect(summary.bbox).toHaveLength(4);
    expect(summary.centroid).not.toBeNull();
  });

  it("gère une couche de lignes sans surface", () => {
    const summary = summarize(geojson("tranchees_parefeu")!);
    expect(summary.geometryTypes).toEqual(["LineString"]);
    expect(perimeterKilometres(geojson("tranchees_parefeu")!)).toBe(0);
  });
});

describe("Validation d'un GeoJSON déposé", () => {
  const validFeature = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { nom: "Point de relevé" },
        geometry: { type: "Point", coordinates: [6.01, 35.64] },
      },
    ],
  };

  it("accepte une FeatureCollection correcte", () => {
    const parsed = parseUploadedGeoJson(validFeature);
    expect(parsed.features).toHaveLength(1);
  });

  it("enveloppe une entité seule dans une FeatureCollection", () => {
    const parsed = parseUploadedGeoJson(validFeature.features[0]);
    expect(parsed.type).toBe("FeatureCollection");
    expect(parsed.features).toHaveLength(1);
  });

  it("enveloppe une géométrie seule", () => {
    const parsed = parseUploadedGeoJson({ type: "Point", coordinates: [6.01, 35.64] });
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0]?.geometry?.type).toBe("Point");
  });

  it("refuse un contenu qui n'est pas du GeoJSON", () => {
    expect(() => parseUploadedGeoJson("bonjour")).toThrowError(ApiError);
    expect(() => parseUploadedGeoJson({ colonnes: ["a", "b"] })).toThrowError(ApiError);
  });

  it("refuse une collection vide en expliquant quoi vérifier", () => {
    try {
      parseUploadedGeoJson({ type: "FeatureCollection", features: [] });
      expect.unreachable("une collection vide doit être refusée");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain("aucune entité");
      expect((error as ApiError).message).toContain("logiciel SIG");
    }
  });

  it("refuse un anneau polygonal non fermé", () => {
    try {
      parseUploadedGeoJson({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [6.0, 35.6],
                  [6.1, 35.6],
                  [6.1, 35.7],
                  [6.0, 35.7],
                ],
              ],
            },
          },
        ],
      });
      expect.unreachable("un anneau ouvert doit être refusé");
    } catch (error) {
      expect((error as ApiError).message).toContain("fermé");
    }
  });

  it("refuse des coordonnées inversées lat/lng", () => {
    expect(() =>
      parseUploadedGeoJson({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            // 35,64 en longitude est valide, mais 6,01 puis 135 en latitude ne l'est pas.
            geometry: { type: "Point", coordinates: [35.64, 135.01] },
          },
        ],
      }),
    ).toThrowError(ApiError);
  });

  it("refuse au-delà de 20 000 entités avec un message chiffré et actionnable", () => {
    const tooMany = {
      type: "FeatureCollection",
      features: Array.from({ length: UPLOAD_LIMITS.maxFeatures + 1 }, (_, index) => ({
        type: "Feature",
        properties: { index },
        geometry: { type: "Point", coordinates: [6.01, 35.64] },
      })),
    };

    try {
      parseUploadedGeoJson(tooMany);
      expect.unreachable("le dépassement du plafond doit être refusé");
    } catch (error) {
      const message = (error as ApiError).message;
      // `toLocaleString("fr-FR")` sépare les milliers par une espace fine
      // insécable (U+202F), pas par une espace ordinaire.
      expect(message).toContain((UPLOAD_LIMITS.maxFeatures + 1).toLocaleString("fr-FR"));
      expect(message).toContain(UPLOAD_LIMITS.maxFeatures.toLocaleString("fr-FR"));
      expect(message).toContain("Simplifiez la géométrie");
    }
  });

  it("refuse un fichier sans aucune géométrie", () => {
    try {
      parseUploadedGeoJson({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { nom: "sans forme" }, geometry: null }],
      });
      expect.unreachable("une table attributaire seule doit être refusée");
    } catch (error) {
      expect((error as ApiError).message).toContain("table");
    }
  });
});
