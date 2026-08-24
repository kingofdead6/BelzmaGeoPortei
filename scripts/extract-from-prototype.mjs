#!/usr/bin/env node
/**
 * Extraction des données du prototype statique `belezma-geoportail_13.html`
 * vers les fichiers de seed du serveur et les assets du client.
 *
 * Le prototype (~2,8 Mo) contient, en dur dans une balise <script>, la totalité
 * des données du Parc National de Belezma : limite officielle, 19 couches SIG,
 * catalogue, tableaux d'espèces, patrimoine de démonstration et deux
 * photographies encodées en base64.
 *
 * Usage : node scripts/extract-from-prototype.mjs [chemin/vers/prototype.html]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE = resolve(process.argv[2] ?? join(ROOT, "belezma-geoportail_13.html"));
const SEED_DIR = join(ROOT, "server", "seed");
const GEOJSON_DIR = join(SEED_DIR, "geojson");
const ASSETS_DIR = join(ROOT, "client", "src", "assets");

/* ------------------------------------------------------------------ *
 * Bbox de référence du parc (limites larges de contrôle de cohérence)
 * ------------------------------------------------------------------ */
// Emprise nominale annoncée par le cahier des charges — conservée à titre de
// comparaison. L'emprise réelle est calculée à partir de la limite officielle
// (voir `parkEnvelope`), qui déborde vers l'est jusqu'à lng ≈ 6,31.
const NOMINAL_BBOX = { minLng: 5.87, minLat: 35.5, maxLng: 6.15, maxLat: 35.75 };

// Tolérance autour de l'emprise officielle : certaines couches (routes,
// circuits touristiques) débordent volontairement vers Batna et les communes
// voisines.
const BBOX_TOLERANCE = 0.2;

// Emprise de référence, renseignée après extraction de la limite officielle.
let parkEnvelope = null;

/* ------------------------------------------------------------------ *
 * Couches vides connues dans les fichiers KMZ/SHP d'origine
 * ------------------------------------------------------------------ */
const KNOWN_EMPTY = new Set(["juniperaie", "secteur_conservation", "urbain", "zone_transition"]);

const EXPECTED_LAYER_KEYS = [
  "zone_centrale", "zone_tampon", "cedraie", "chenaie", "pinede", "pelouses",
  "friches_cultures", "terrains_nus", "falaises", "hydrographique",
  "grottes_gisements", "mines_grottes", "routes", "lignes_electriques",
  "poste_vigie", "piste_degradee", "piste_praticable", "tranchees_parefeu",
  "circuits_touristiques",
];

/* ------------------------------------------------------------------ *
 * Utilitaires
 * ------------------------------------------------------------------ */
const warnings = [];
const errors = [];

function warn(msg) { warnings.push(msg); }
function fail(msg) { errors.push(msg); }

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeJson(path, value) {
  const json = JSON.stringify(value);
  writeFileSync(path, json);
  return Buffer.byteLength(json);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

/**
 * Extrait la valeur littérale d'une constante JS du prototype par équilibrage
 * des accolades / crochets, en ignorant ce qui se trouve dans les chaînes.
 * Plus fiable qu'une expression régulière sur des blobs GeoJSON de 2 Mo.
 */
function extractLiteral(source, name) {
  const declaration = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`, "m");
  const match = declaration.exec(source);
  if (!match) throw new Error(`Constante \`${name}\` introuvable dans le prototype.`);

  let i = match.index + match[0].length;
  const open = source[i];
  if (open !== "{" && open !== "[") {
    throw new Error(`\`${name}\` n'est pas un littéral objet ou tableau (trouvé « ${open} »).`);
  }
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inString = null;
  let escaped = false;

  for (; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const literal = source.slice(match.index + match[0].length, i + 1);
        // Les littéraux du prototype utilisent des clés non quotées et des
        // commentaires de fin de ligne : on les évalue plutôt que JSON.parse.
        // eslint-disable-next-line no-new-func
        return Function(`"use strict"; return (${literal});`)();
      }
    }
  }
  throw new Error(`Littéral \`${name}\` non terminé — parenthésage déséquilibré.`);
}

/* ------------------------------------------------------------------ *
 * Validation GeoJSON
 * ------------------------------------------------------------------ */
function walkPositions(geometry, visit) {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    (geometry.geometries ?? []).forEach((g) => walkPositions(g, visit));
    return;
  }
  const recurse = (coords, depth) => {
    if (depth === 0) { visit(coords); return; }
    if (!Array.isArray(coords)) return;
    coords.forEach((c) => recurse(c, depth - 1));
  };
  const depthByType = {
    Point: 0, MultiPoint: 1, LineString: 1,
    MultiLineString: 2, Polygon: 2, MultiPolygon: 3,
  };
  const depth = depthByType[geometry.type];
  if (depth === undefined) return;
  recurse(geometry.coordinates, depth);
}

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates ?? [];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates ?? []).flat();
  return [];
}

function validateFeatureCollection(id, fc) {
  const report = {
    id,
    features: 0,
    geometryTypes: [],
    positions: 0,
    bbox: null,
    issues: [],
  };

  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    report.issues.push("n'est pas une FeatureCollection valide");
    return report;
  }

  report.features = fc.features.length;
  const types = new Set();
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  let outOfRange = 0;
  let outOfPark = 0;
  let badRings = 0;
  let nullGeometries = 0;

  fc.features.forEach((feature, index) => {
    if (feature?.type !== "Feature") {
      report.issues.push(`entité ${index} : \`type\` attendu « Feature »`);
      return;
    }
    const geometry = feature.geometry;
    if (!geometry) { nullGeometries++; return; }
    types.add(geometry.type);

    for (const ring of ringsOf(geometry)) {
      if (!Array.isArray(ring) || ring.length < 4) { badRings++; continue; }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) badRings++;
    }

    walkPositions(geometry, (position) => {
      if (!Array.isArray(position) || position.length < 2) { outOfRange++; return; }
      const [lng, lat] = position;
      if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
        outOfRange++;
        return;
      }
      // Ordre [lng, lat] : une latitude > 90 signale une inversion.
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { outOfRange++; return; }
      report.positions++;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      if (
        parkEnvelope &&
        (lng < parkEnvelope[0] - BBOX_TOLERANCE || lng > parkEnvelope[2] + BBOX_TOLERANCE ||
         lat < parkEnvelope[1] - BBOX_TOLERANCE || lat > parkEnvelope[3] + BBOX_TOLERANCE)
      ) {
        outOfPark++;
      }
    });
  });

  report.geometryTypes = [...types].sort();
  if (report.positions > 0) report.bbox = [minLng, minLat, maxLng, maxLat];

  if (nullGeometries) report.issues.push(`${nullGeometries} entité(s) sans géométrie`);
  if (badRings) report.issues.push(`${badRings} anneau(x) polygonal(aux) non fermé(s) ou trop court(s)`);
  if (outOfRange) report.issues.push(`${outOfRange} position(s) hors plage lng/lat — ordre des coordonnées à vérifier`);
  if (outOfPark) report.issues.push(`${outOfPark} position(s) hors de l'emprise du parc`);
  if (report.features === 0) report.issues.push("couche vide");

  return report;
}

/* ------------------------------------------------------------------ *
 * Extraction
 * ------------------------------------------------------------------ */
function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Prototype introuvable : ${SOURCE}`);
    process.exit(1);
  }

  const html = readFileSync(SOURCE, "utf8");
  console.log(`Source : ${SOURCE} (${formatBytes(Buffer.byteLength(html))})\n`);

  ensureDir(GEOJSON_DIR);
  ensureDir(ASSETS_DIR);

  const reports = [];

  /* --- Limite officielle du parc ---------------------------------- */
  const boundary = extractLiteral(html, "PARK_BOUNDARY_GEOJSON");
  const boundaryReport = validateFeatureCollection("boundary", boundary);
  boundaryReport.bytes = writeJson(join(GEOJSON_DIR, "boundary.geojson"), boundary);
  reports.push(boundaryReport);

  parkEnvelope = boundaryReport.bbox;
  if (parkEnvelope) {
    const [minLng, minLat, maxLng, maxLat] = parkEnvelope;
    if (
      minLng < NOMINAL_BBOX.minLng || maxLng > NOMINAL_BBOX.maxLng ||
      minLat < NOMINAL_BBOX.minLat || maxLat > NOMINAL_BBOX.maxLat
    ) {
      warn(
        `L'emprise réelle de la limite officielle (lng ${minLng.toFixed(4)}→${maxLng.toFixed(4)}, ` +
        `lat ${minLat.toFixed(4)}→${maxLat.toFixed(4)}) déborde de l'emprise nominale ` +
        `(lng ${NOMINAL_BBOX.minLng}→${NOMINAL_BBOX.maxLng}, lat ${NOMINAL_BBOX.minLat}→${NOMINAL_BBOX.maxLat}). ` +
        `C'est l'emprise calculée qui fait foi.`,
      );
    }
  }

  const boundaryProps = boundary.features?.[0]?.properties ?? {};
  for (const key of ["superficie", "Shape_Leng"]) {
    if (!(key in boundaryProps)) warn(`boundary.geojson : propriété \`${key}\` absente de la limite officielle.`);
  }

  /* --- 19 couches SIG --------------------------------------------- */
  const layerData = extractLiteral(html, "LAYER_DATA");
  const layerKeys = Object.keys(layerData);

  for (const expected of EXPECTED_LAYER_KEYS) {
    if (!layerKeys.includes(expected)) fail(`Couche attendue \`${expected}\` absente de LAYER_DATA.`);
  }
  for (const found of layerKeys) {
    if (!EXPECTED_LAYER_KEYS.includes(found)) warn(`Couche \`${found}\` présente dans LAYER_DATA mais absente de la liste attendue.`);
  }

  for (const key of layerKeys) {
    const report = validateFeatureCollection(key, layerData[key]);
    report.bytes = writeJson(join(GEOJSON_DIR, `${key}.geojson`), layerData[key]);
    reports.push(report);
  }

  for (const key of KNOWN_EMPTY) {
    if (!layerKeys.includes(key)) {
      warn(`Couche \`${key}\` non extraite — vide dans les fichiers source d'origine, conforme aux notes du prototype.`);
    }
  }

  /* --- Catalogue --------------------------------------------------- */
  const catalog = extractLiteral(html, "CATALOG");
  const catalogBytes = writeJson(join(SEED_DIR, "catalog.json"), catalog);

  const catalogIds = new Set(catalog.map((entry) => entry.id));
  for (const key of EXPECTED_LAYER_KEYS) {
    if (!catalogIds.has(key)) warn(`Couche \`${key}\` absente du CATALOG.`);
  }
  for (const entry of catalog) {
    if (entry.id === "boundary" || !entry.official) continue;
    if (entry.type === "inaturalist") continue;
    if (!layerKeys.includes(entry.id)) warn(`Entrée de catalogue \`${entry.id}\` sans géométrie dans LAYER_DATA.`);
  }

  /* --- Espèces ------------------------------------------------------ */
  const speciesData = extractLiteral(html, "SPECIES_DATA");
  const speciesTabs = extractLiteral(html, "SPECIES_TABS");

  const datasets = [];
  let speciesTotal = 0;

  for (const tab of speciesTabs) {
    const raw = speciesData[tab.id];
    if (raw === undefined) {
      fail(`Jeu de données \`${tab.id}\` déclaré dans SPECIES_TABS mais absent de SPECIES_DATA.`);
      continue;
    }
    // `faune_endemisme` est un objet { groupe: [...] }, les autres des tableaux.
    const records = Array.isArray(raw)
      ? raw.map((record) => ({ ...record }))
      : Object.entries(raw).flatMap(([groupe, list]) => list.map((record) => ({ groupe, ...record })));

    speciesTotal += records.length;
    datasets.push({
      id: tab.id,
      label: tab.label,
      kind: tab.kind,
      grouped: !Array.isArray(raw),
      count: records.length,
      fields: [...new Set(records.flatMap((record) => Object.keys(record)))],
      records,
    });
  }

  for (const key of Object.keys(speciesData)) {
    if (!speciesTabs.some((tab) => tab.id === key)) {
      warn(`Jeu de données \`${key}\` présent dans SPECIES_DATA mais absent de SPECIES_TABS.`);
    }
  }

  const speciesBytes = writeJson(join(SEED_DIR, "species.json"), {
    source: "Tome II — Milieu Biotique (2026), Parc National de Belezma",
    tabs: speciesTabs,
    datasets,
  });

  /* --- Patrimoine de démonstration ---------------------------------- */
  const demoHeritage = extractLiteral(html, "DEMO_HERITAGE");
  const heritage = demoHeritage.map((site) => ({ ...site, demo: true }));
  const heritageBytes = writeJson(join(SEED_DIR, "heritage.json"), heritage);

  /* --- Observations d'espèces de démonstration ---------------------- */
  const speciesMapPoints = extractLiteral(html, "SPECIES_MAP_POINTS");
  const observationsBytes = writeJson(
    join(SEED_DIR, "demo-observations.json"),
    speciesMapPoints.map((point) => ({ ...point, demo: true })),
  );

  /* --- Fonds de carte et couleurs UICN ------------------------------ */
  const basemaps = extractLiteral(html, "BASEMAPS");
  const iucnColors = extractLiteral(html, "IUCN_COLORS");
  const inaturalistColors = extractLiteral(html, "INATURALIST_COLORS");
  const referenceBytes = writeJson(join(SEED_DIR, "reference.json"), {
    basemaps,
    iucnColors,
    inaturalistColors,
    parkBbox: parkEnvelope,
    nominalBbox: NOMINAL_BBOX,
  });

  /* --- Photographies encodées en base64 ------------------------------ */
  const imageNames = ["hero-belezma.jpg", "paysage-belezma-01.jpg"];
  const images = [];
  const seenImages = new Map();
  const base64Pattern = /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g;
  let imageMatch;
  let imageIndex = 0;
  let duplicates = 0;
  while ((imageMatch = base64Pattern.exec(html)) !== null) {
    const buffer = Buffer.from(imageMatch[1], "base64");
    // Contrôle des octets magiques JPEG (FF D8 FF).
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      warn(`Image ${imageIndex + 1} : en-tête JPEG invalide, ignorée.`);
      imageIndex++;
      continue;
    }
    // Le prototype réutilise la même photographie pour le héros et la galerie :
    // on ne l'écrit qu'une fois.
    const digest = createHash("sha256").update(buffer).digest("hex");
    if (seenImages.has(digest)) {
      duplicates++;
      imageIndex++;
      continue;
    }
    const name = imageNames[images.length] ?? `paysage-belezma-${String(images.length).padStart(2, "0")}.jpg`;
    seenImages.set(digest, name);
    writeFileSync(join(ASSETS_DIR, name), buffer);
    images.push({ name, bytes: buffer.length, digest: digest.slice(0, 12) });
    imageIndex++;
  }
  if (duplicates) {
    warn(`${duplicates} image(s) en double ignorée(s) — le prototype réutilise la photographie du héros dans la galerie.`);
  }
  if (images.length < 2) {
    warn(`${images.length} photographie(s) distincte(s) dans le prototype : les cinq autres vignettes de la galerie « Paysages du Belezma » sont des emplacements réservés sans image. Des photographies réelles seront nécessaires.`);
  }

  /* ---------------------------------------------------------------- *
   * Rapport
   * ---------------------------------------------------------------- */
  const pad = (value, width) => String(value).padEnd(width);
  const padStart = (value, width) => String(value).padStart(width);

  console.log("INVENTAIRE DES COUCHES");
  console.log("─".repeat(112));
  console.log(
    `${pad("identifiant", 24)} ${padStart("entités", 8)} ${padStart("positions", 10)} ${pad("géométries", 26)} ${padStart("taille", 10)}  observations`,
  );
  console.log("─".repeat(112));

  let totalFeatures = 0;
  let totalBytes = 0;
  for (const report of reports) {
    totalFeatures += report.features;
    totalBytes += report.bytes;
    const flag = report.issues.length ? `⚠ ${report.issues.join(" ; ")}` : "conforme";
    console.log(
      `${pad(report.id, 24)} ${padStart(report.features, 8)} ${padStart(report.positions, 10)} ${pad(report.geometryTypes.join(", ") || "—", 26)} ${padStart(formatBytes(report.bytes), 10)}  ${flag}`,
    );
  }
  console.log("─".repeat(112));
  console.log(
    `${pad(`${reports.length} couches`, 24)} ${padStart(totalFeatures, 8)} ${padStart("", 10)} ${pad("", 26)} ${padStart(formatBytes(totalBytes), 10)}\n`,
  );

  console.log("EMPRISE DE LA LIMITE OFFICIELLE");
  if (boundaryReport.bbox) {
    const [minLng, minLat, maxLng, maxLat] = boundaryReport.bbox;
    console.log(`  lng ${minLng.toFixed(5)} → ${maxLng.toFixed(5)}   lat ${minLat.toFixed(5)} → ${maxLat.toFixed(5)}`);
  }
  console.log(`  propriétés : ${Object.keys(boundaryProps).join(", ")}\n`);

  console.log("JEUX DE DONNÉES ESPÈCES");
  console.log("─".repeat(112));
  console.log(`${pad("identifiant", 30)} ${padStart("fiches", 8)}  ${pad("type", 16)} champs`);
  console.log("─".repeat(112));
  for (const dataset of datasets) {
    console.log(`${pad(dataset.id, 30)} ${padStart(dataset.count, 8)}  ${pad(dataset.kind, 16)} ${dataset.fields.join(", ")}`);
  }
  console.log("─".repeat(112));
  console.log(`${pad(`${datasets.length} jeux`, 30)} ${padStart(speciesTotal, 8)}  ${formatBytes(speciesBytes)}\n`);

  console.log("AUTRES FICHIERS ÉMIS");
  console.log(`  server/seed/catalog.json            ${padStart(catalog.length, 4)} entrées   ${formatBytes(catalogBytes)}`);
  console.log(`  server/seed/heritage.json           ${padStart(heritage.length, 4)} sites     ${formatBytes(heritageBytes)} (marqués DEMO)`);
  console.log(`  server/seed/demo-observations.json  ${padStart(speciesMapPoints.length, 4)} points    ${formatBytes(observationsBytes)} (marqués DEMO)`);
  console.log(`  server/seed/reference.json          ${padStart(Object.keys(basemaps).length, 4)} fonds     ${formatBytes(referenceBytes)}`);
  for (const image of images) {
    console.log(`  client/src/assets/${pad(image.name, 26)}      ${formatBytes(image.bytes)}`);
  }
  console.log();

  if (warnings.length) {
    console.log("AVERTISSEMENTS");
    warnings.forEach((message) => console.log(`  ⚠ ${message}`));
    console.log();
  }

  if (errors.length) {
    console.log("ERREURS");
    errors.forEach((message) => console.log(`  ✖ ${message}`));
    console.log();
    process.exitCode = 1;
    return;
  }

  console.log("Extraction terminée.");
}

main();
