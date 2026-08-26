import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection, HeritageCategory, LayerType, SpeciesDatasetId, SpeciesKind } from "@belezma/shared";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Les fichiers de seed sont produits par `scripts/extract-from-prototype.mjs`
 * et vivent dans `server/seed/`. Ils sont résolus depuis les sources comme
 * depuis `dist/`.
 */
function seedRoot(): string {
  const candidates = [join(here, "../../seed"), join(here, "../../../seed")];
  const found = candidates.find((candidate) => existsSync(join(candidate, "catalog.json")));
  if (!found) {
    throw new Error(
      "Fichiers de seed introuvables. Lancez d'abord : npm run extract",
    );
  }
  return found;
}

const root = seedRoot();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8")) as T;
}

export interface CatalogEntry {
  id: string;
  name: string;
  group: string;
  official: boolean;
  color: string;
  fillOpacity: number;
  weight: number;
  visible: boolean;
  type: string;
}

export interface SpeciesSeedRecord {
  nom_scientifique?: string;
  espece?: string;
  nom_commun?: string;
  famille?: string;
  ordre?: string;
  groupe?: string;
  statut_uicn?: string;
  rarete?: string;
  chorotype?: string;
  endemisme?: string;
}

export interface SpeciesSeedFile {
  source: string;
  tabs: { id: SpeciesDatasetId; label: string; kind: SpeciesKind }[];
  datasets: {
    id: SpeciesDatasetId;
    label: string;
    kind: SpeciesKind;
    grouped: boolean;
    count: number;
    fields: string[];
    records: SpeciesSeedRecord[];
  }[];
}

export interface HeritageSeedRecord {
  category: HeritageCategory;
  title: string;
  description: string;
  lat: number;
  lng: number;
  demo: boolean;
}

export interface DemoObservationRecord {
  lat: number;
  lng: number;
  props: Record<string, string>;
  demo: boolean;
}

export interface ReferenceFile {
  basemaps: Record<string, { url: string; attribution: string }>;
  iucnColors: Record<string, string>;
  inaturalistColors: Record<string, string>;
  parkBbox: [number, number, number, number];
  nominalBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
}

export const catalog = (): CatalogEntry[] => readJson<CatalogEntry[]>("catalog.json");
export const speciesFile = (): SpeciesSeedFile => readJson<SpeciesSeedFile>("species.json");
export const heritage = (): HeritageSeedRecord[] => readJson<HeritageSeedRecord[]>("heritage.json");
export const demoObservations = (): DemoObservationRecord[] =>
  readJson<DemoObservationRecord[]>("demo-observations.json");
export const reference = (): ReferenceFile => readJson<ReferenceFile>("reference.json");

export function geojson(layerId: string): FeatureCollection | null {
  const path = join(root, "geojson", `${layerId}.geojson`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as FeatureCollection;
}

export function availableGeojsonIds(): string[] {
  return readdirSync(join(root, "geojson"))
    .filter((name) => name.endsWith(".geojson"))
    .map((name) => name.replace(/\.geojson$/, ""));
}

/**
 * Traduit le `type` du prototype vers le vocabulaire du modèle. Les types
 * propres au prototype (`point-demo`, `inaturalist`) ne décrivent pas une
 * couche officielle stockée en base.
 */
export function toLayerType(prototypeType: string): LayerType | null {
  switch (prototypeType) {
    case "polygon":
      return "polygon";
    case "line":
      return "line";
    case "point":
      return "point";
    case "mixed":
      return "mixed";
    default:
      return null;
  }
}
