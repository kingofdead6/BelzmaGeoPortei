/**
 * Peuplement de la base : catalogue officiel, espèces du Tome II, patrimoine
 * de démonstration, puis les comptes et contributions de démonstration
 * couvrant chaque état du cycle de vie (§11).
 *
 * Usage : npm run seed [-- --keep-users]
 */
import bcrypt from "bcrypt";
import type mongoose from "mongoose";
import { IUCN_STATUSES, PARK_AREA_REFERENCE_HA } from "@belezma/shared";
import type { IucnStatus, SpeciesDatasetId } from "@belezma/shared";
import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import {
  Contribution,
  ModerationLog,
  OfficialLayer,
  RefreshToken,
  Report,
  Species,
  User,
  type ContributionAttributes,
} from "../models/index.js";
import {
  areaHectares,
  boundingBoxOf,
  isInsideBoundary,
  perimeterKilometres,
  summarize,
} from "../services/geometry.js";
import {
  catalog,
  demoObservations,
  geojson,
  heritage,
  speciesFile,
  toLayerType,
} from "./load-seed-files.js";

const KEEP_USERS = process.argv.includes("--keep-users");

/** Mots de passe de démonstration — à usage local uniquement. */
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "belezma-demo-2026";

function line(label: string, value: string | number): void {
  console.log(`  ${label.padEnd(42, " ")} ${value}`);
}

async function seedLayers(): Promise<{ count: number; areaHa: number; perimeterKm: number }> {
  console.log("\nCouches officielles");
  await OfficialLayer.deleteMany({});

  const entries = catalog();
  let order = 0;
  let inserted = 0;
  let areaHa = 0;
  let perimeterKm = 0;

  for (const entry of entries) {
    const layerType = toLayerType(entry.type);
    if (!layerType) {
      // `point-demo` et `inaturalist` ne sont pas des couches stockées :
      // la première vient des contributions, la seconde d'une API tierce.
      continue;
    }

    const collection = geojson(entry.id);
    if (!collection) {
      line(entry.id, "ignorée — aucune géométrie extraite");
      continue;
    }

    const stats = summarize(collection);

    if (entry.id === "boundary") {
      areaHa = areaHectares(collection);
      perimeterKm = perimeterKilometres(collection);
    }

    await OfficialLayer.create({
      layerId: entry.id,
      name: entry.name,
      group: entry.group,
      type: layerType,
      color: entry.color,
      fillOpacity: entry.fillOpacity,
      weight: entry.weight,
      defaultVisible: entry.visible,
      official: true,
      order: (order += 10),
      geojson: collection,
      featureCount: stats.featureCount,
      bbox: stats.bbox ?? [],
      source: "Shapefiles et KMZ officiels du Parc National de Belezma",
    });

    inserted += 1;
    line(entry.name, `${stats.featureCount} entités · ${stats.geometryTypes.join(", ")}`);
  }

  return { count: inserted, areaHa, perimeterKm };
}

async function seedSpecies(): Promise<number> {
  console.log("\nEspèces — Tome II, Milieu Biotique (2026)");
  await Species.deleteMany({});

  const file = speciesFile();
  const documents = file.datasets.flatMap((dataset) =>
    dataset.records.map((record, index) => ({
      dataset: dataset.id as SpeciesDatasetId,
      kind: dataset.kind,
      nom_scientifique: record.nom_scientifique ?? null,
      espece: record.espece ?? null,
      nom_commun: record.nom_commun ?? null,
      famille: record.famille ?? null,
      ordre: record.ordre ?? null,
      groupe: record.groupe ?? null,
      statut_uicn: isIucnStatus(record.statut_uicn) ? record.statut_uicn : null,
      rarete: record.rarete ?? null,
      chorotype: record.chorotype ?? null,
      endemisme: record.endemisme ?? null,
      order: index,
    })),
  );

  await Species.insertMany(documents);

  for (const dataset of file.datasets) {
    line(dataset.label, `${dataset.count} fiches`);
  }
  return documents.length;
}

function isIucnStatus(value: string | undefined): value is IucnStatus {
  return typeof value === "string" && (IUCN_STATUSES as readonly string[]).includes(value);
}

interface SeededUsers {
  admin: mongoose.Types.ObjectId;
  moderator: mongoose.Types.ObjectId;
  amina: mongoose.Types.ObjectId;
  karim: mongoose.Types.ObjectId;
}

async function seedUsers(): Promise<SeededUsers> {
  console.log("\nComptes de démonstration");
  await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({})]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const accounts = [
    {
      key: "admin" as const,
      email: "admin@belezma.dz",
      displayName: "Direction du Parc National de Belezma",
      role: "admin" as const,
      organization: "Parc National de Belezma",
      bio: "Compte d'administration du géoportail : catalogue officiel, comptes et statistiques.",
    },
    {
      key: "moderator" as const,
      email: "moderation@belezma.dz",
      displayName: "Service scientifique",
      role: "moderator" as const,
      organization: "Parc National de Belezma",
      bio: "Validation des contributions déposées par le public avant leur publication.",
    },
    {
      key: "amina" as const,
      email: "amina.bouzid@exemple.dz",
      displayName: "Amina Bouzid",
      role: "user" as const,
      organization: "Association des amis du Belezma",
      bio: "Randonneuse et photographe amateur, je documente la cédraie de Talmet depuis 2019.",
    },
    {
      key: "karim" as const,
      email: "karim.lounis@exemple.dz",
      displayName: "Karim Lounis",
      role: "user" as const,
      organization: "Université Batna 1",
      bio: "Doctorant en écologie forestière, je travaille sur la régénération du cèdre de l'Atlas.",
    },
  ];

  const created: Partial<SeededUsers> = {};
  for (const account of accounts) {
    const user = await User.create({
      email: account.email,
      passwordHash,
      displayName: account.displayName,
      role: account.role,
      organization: account.organization,
      bio: account.bio,
      emailVerified: true,
      status: "active",
    });
    created[account.key] = user._id;
    line(`${account.displayName} (${account.role})`, account.email);
  }

  line("mot de passe commun", DEMO_PASSWORD);
  return created as SeededUsers;
}

/** Sous-ensemble des champs renseignés par le peuplement. */
type SeedContribution = Omit<
  ContributionAttributes,
  "createdAt" | "updatedAt" | "viewCount" | "flagCount"
> &
  Partial<Pick<ContributionAttributes, "viewCount" | "flagCount">>;

async function seedContributions(users: SeededUsers): Promise<number> {
  console.log("\nContributions de démonstration");
  await Promise.all([Contribution.deleteMany({}), Report.deleteMany({}), ModerationLog.deleteMany({})]);

  const now = Date.now();
  const daysAgo = (days: number): Date => new Date(now - days * 24 * 60 * 60 * 1000);

  const heritageSites = heritage();
  const observations = demoObservations();

  const documents: SeedContribution[] = [
    // Publiée — visible de tous, sur la carte et dans la galerie.
    {
      owner: users.amina,
      kind: "photo" as const,
      title: "Cédraie de Tichaou sous la neige",
      description:
        "Le versant nord de Tichaou après les chutes de neige de février. Les cèdres les plus âgés du peuplement dépassent 300 ans.",
      tags: ["cédraie", "tichaou", "hiver"],
      visibility: "public" as const,
      publishedAt: daysAgo(12),
      reviewedBy: users.moderator,
      reviewedAt: daysAgo(12),
      location: { type: "Point" as const, coordinates: [5.9689, 35.5353] as [number, number] },
      viewCount: 148,
    },
    // Observation publiée, rattachée à une espèce du Tome II.
    {
      owner: users.karim,
      kind: "observation" as const,
      title: "Aigle royal en vol au-dessus de Bouilef",
      description: "Individu adulte observé en vol plané vers 9 h, altitude estimée 1 600 m.",
      tags: ["oiseaux", "rapaces", "boumerzoug"],
      visibility: "public" as const,
      publishedAt: daysAgo(6),
      reviewedBy: users.moderator,
      reviewedAt: daysAgo(6),
      location: { type: "Point" as const, coordinates: [6.1905, 35.599] as [number, number] },
      species: {
        scientificName: "Aquila chrysaetos",
        commonName: "Aigle royal",
        iucnStatus: "LC" as const,
        group: "Oiseaux",
      },
      viewCount: 63,
    },
    // En attente de validation — alimente la file de modération.
    {
      owner: users.karim,
      kind: "observation" as const,
      title: "Régénération naturelle du cèdre, cédraie de Bordjem",
      description:
        "Semis de moins de trois ans relevés sur un transect de 50 m. Densité estimée à 1 200 pieds par hectare.",
      tags: ["cèdre", "régénération", "relevé"],
      visibility: "pending" as const,
      location: { type: "Point" as const, coordinates: [6.0091, 35.5931] as [number, number] },
      species: {
        scientificName: "Cedrus atlantica",
        commonName: "Cèdre de l'Atlas",
        iucnStatus: "EN" as const,
        group: "Flore",
      },
    },
    // Privée — visible du seul propriétaire.
    {
      owner: users.amina,
      kind: "photo" as const,
      title: "Col de Talmet, brouillard matinal",
      description: "Prise de vue personnelle, à retravailler avant publication.",
      tags: ["sentier", "brouillard"],
      visibility: "private" as const,
      location: { type: "Point" as const, coordinates: [6.0546, 35.5999] as [number, number] },
    },
    // Refusée — le motif doit parvenir au contributeur.
    {
      owner: users.amina,
      kind: "photo" as const,
      title: "Vue depuis la route de Batna",
      description: "Panorama pris depuis la nationale.",
      tags: ["panorama"],
      visibility: "rejected" as const,
      rejectedReason:
        "La photographie ne montre pas le Parc National de Belezma ou ses abords immédiats : le cadrage porte sur la zone urbaine de Batna.",
      reviewedBy: users.moderator,
      reviewedAt: daysAgo(3),
      // Volontairement hors limite : c'est précisément le motif du refus.
      location: { type: "Point" as const, coordinates: [6.1742, 35.5561] as [number, number] },
    },
  ];

  // Sites patrimoniaux de démonstration, portés par le compte d'administration.
  for (const site of heritageSites) {
    documents.push({
      owner: users.admin,
      kind: "heritage" as const,
      title: site.title,
      description: site.description,
      tags: ["démonstration", site.category.toLowerCase()],
      visibility: "public" as const,
      publishedAt: daysAgo(30),
      reviewedBy: users.admin,
      reviewedAt: daysAgo(30),
      location: { type: "Point" as const, coordinates: [site.lng, site.lat] as [number, number] },
      heritage: { category: site.category },
    });
  }

  // Observations d'espèces de démonstration issues du prototype.
  for (const observation of observations) {
    const scientificName = observation.props["Nom scientifique"] ?? "Espèce non déterminée";
    const commonName = observation.props["Nom français"] ?? null;
    const status = observation.props["Statut UICN"];
    documents.push({
      owner: users.admin,
      kind: "observation" as const,
      title: `${commonName ?? scientificName} (démonstration)`,
      description:
        "Point de démonstration repris du prototype : la localisation est indicative et non relevée sur le terrain.",
      tags: ["démonstration"],
      visibility: "public" as const,
      publishedAt: daysAgo(30),
      reviewedBy: users.admin,
      reviewedAt: daysAgo(30),
      location: { type: "Point" as const, coordinates: [observation.lng, observation.lat] as [number, number] },
      species: {
        scientificName,
        commonName,
        iucnStatus: isIucnStatus(status) ? status : null,
        group: null,
      },
    });
  }

  // Couche SIG publiée par un contributeur : reprise de la couche officielle
  // des postes de vigie, restylée, pour illustrer le groupe « Contributions ».
  const vigie = geojson("poste_vigie");
  if (vigie) {
    const stats = summarize(vigie);
    documents.push({
      owner: users.karim,
      kind: "layer" as const,
      title: "Postes de vigie — relevé GPS de terrain",
      description:
        "Position des trois postes de vigie relevée au GPS en mai 2026, à comparer avec la couche officielle.",
      tags: ["vigie", "gps", "terrain"],
      visibility: "public" as const,
      publishedAt: daysAgo(9),
      reviewedBy: users.moderator,
      reviewedAt: daysAgo(9),
      location: stats.centroid
        ? { type: "Point" as const, coordinates: stats.centroid }
        : null,
      layer: {
        geojson: vigie,
        featureCount: stats.featureCount,
        geometryTypes: stats.geometryTypes,
        bbox: stats.bbox ?? [],
        withinPark: true,
        style: { color: "#B8912C", fillOpacity: 0.4, weight: 2 },
        sourceFile: {
          publicId: null,
          url: null,
          originalName: "postes-vigie-releve-2026.geojson",
          bytes: JSON.stringify(vigie).length,
          format: "geojson",
        },
      },
    });
  }

  reportLocationsOutsidePark(documents);

  const inserted = await Contribution.insertMany(documents);

  // Un signalement ouvert, pour que la file de modération ne soit pas vide.
  const publishedPhoto = inserted.find((item) => item.kind === "photo" && item.visibility === "public");
  if (publishedPhoto) {
    await Report.create({
      contribution: publishedPhoto._id,
      reporter: users.karim,
      reason: "donnee_erronee",
      note: "La date indiquée ne correspond pas à l'épisode neigeux de février signalé dans la description.",
      status: "open",
    });
    await Contribution.updateOne({ _id: publishedPhoto._id }, { $inc: { flagCount: 1 } });
  }

  // Journal d'audit correspondant aux décisions déjà prises.
  await ModerationLog.insertMany(
    inserted
      .filter((item) => item.reviewedAt)
      .map((item) => ({
        actor: item.reviewedBy ?? users.moderator,
        action: item.visibility === "rejected" ? ("reject" as const) : ("approve" as const),
        target: { model: "Contribution", id: item._id },
        reason: item.rejectedReason ?? null,
        snapshot: { title: item.title, kind: item.kind, visibility: item.visibility },
        createdAt: item.reviewedAt ?? new Date(),
      })),
  );

  await refreshUserStats();

  const byVisibility = inserted.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.visibility] = (accumulator[item.visibility] ?? 0) + 1;
    return accumulator;
  }, {});
  for (const [visibility, count] of Object.entries(byVisibility)) {
    line(visibility, `${count} contributions`);
  }

  return inserted.length;
}

/**
 * Signale les contributions dont le point tombe hors de la limite officielle.
 * Deux cas sont attendus : la photographie refusée, dont c'est justement le
 * motif, et les sites patrimoniaux de démonstration, que le prototype décrit
 * lui-même comme « non géolocalisés officiellement ».
 */
function reportLocationsOutsidePark(documents: SeedContribution[]): void {
  const boundary = geojson("boundary");
  if (!boundary) return;

  const outside = documents.filter((document) => {
    if (!document.location) return false;
    const [lng, lat] = document.location.coordinates;
    return !isInsideBoundary(lng, lat, boundary);
  });

  if (outside.length === 0) return;

  console.log("\n  Points situés hors de la limite officielle :");
  for (const document of outside) {
    const [lng, lat] = document.location?.coordinates ?? [0, 0];
    const expected = document.visibility === "rejected" || document.tags.includes("démonstration");
    console.log(
      `    ${expected ? "attendu " : "À VÉRIFIER"} ${document.title} (${lng.toFixed(4)}, ${lat.toFixed(4)})`,
    );
  }
}

/** Recalcule les compteurs portés par chaque compte. */
async function refreshUserStats(): Promise<void> {
  const grouped = await Contribution.aggregate<{
    _id: mongoose.Types.ObjectId;
    contributions: number;
    published: number;
  }>([
    {
      $group: {
        _id: "$owner",
        contributions: { $sum: 1 },
        published: { $sum: { $cond: [{ $eq: ["$visibility", "public"] }, 1, 0] } },
      },
    },
  ]);

  await User.bulkWrite(
    grouped.map((group) => ({
      updateOne: {
        filter: { _id: group._id },
        update: { $set: { "stats.contributions": group.contributions, "stats.published": group.published } },
      },
    })),
  );
}

async function main(): Promise<void> {
  console.log("Peuplement de la base — Géoportail du Parc National de Belezma");
  await connectDatabase();

  const layers = await seedLayers();
  const speciesCount = await seedSpecies();

  let users: SeededUsers | null = null;
  let contributionCount = 0;

  if (KEEP_USERS) {
    console.log("\nComptes et contributions conservés (--keep-users).");
  } else {
    users = await seedUsers();
    contributionCount = await seedContributions(users);
  }

  console.log("\nRécapitulatif");
  line("couches officielles", layers.count);
  line("superficie calculée depuis la limite", `${layers.areaHa.toFixed(1)} ha`);
  line("superficie portée par la source", `${PARK_AREA_REFERENCE_HA.toFixed(1)} ha`);
  line("écart", `${(((layers.areaHa - PARK_AREA_REFERENCE_HA) / PARK_AREA_REFERENCE_HA) * 100).toFixed(2)} %`);
  line("périmètre calculé", `${layers.perimeterKm.toFixed(1)} km`);
  line("fiches espèces", speciesCount);
  if (users) line("contributions", contributionCount);

  const boundary = geojson("boundary");
  if (boundary) {
    const box = boundingBoxOf(boundary);
    if (box) line("emprise", box.map((value) => value.toFixed(4)).join(", "));
  }

  await disconnectDatabase();
  console.log("\nBase peuplée.");
}

main().catch((error: unknown) => {
  console.error("Échec du peuplement :", error instanceof Error ? error.message : error);
  void disconnectDatabase().finally(() => process.exit(1));
});
