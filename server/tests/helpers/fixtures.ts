import bcrypt from "bcrypt";
import type { Types } from "mongoose";
import type { UserRole } from "@belezma/shared";
import { Contribution, OfficialLayer, Species, User } from "../../src/models/index.js";
import { geojson } from "../../src/seed/load-seed-files.js";
import { summarize } from "../../src/services/geometry.js";

export const TEST_PASSWORD = "un-mot-de-passe-solide";

let passwordHashCache: string | null = null;

async function passwordHash(): Promise<string> {
  // bcrypt à coût 12 est délibérément lent : on ne le calcule qu'une fois.
  passwordHashCache ??= await bcrypt.hash(TEST_PASSWORD, 12);
  return passwordHashCache;
}

export async function createUser(
  overrides: Partial<{ email: string; displayName: string; role: UserRole; status: "active" | "suspended" }> = {},
): Promise<{ id: string; _id: Types.ObjectId; email: string }> {
  const email = overrides.email ?? `contributeur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.dz`;
  const user = await User.create({
    email,
    passwordHash: await passwordHash(),
    displayName: overrides.displayName ?? "Contributrice de test",
    role: overrides.role ?? "user",
    status: overrides.status ?? "active",
    emailVerified: true,
  });
  return { id: String(user._id), _id: user._id, email };
}

export async function createContribution(
  owner: Types.ObjectId,
  overrides: Partial<{
    kind: "photo" | "layer" | "heritage" | "observation";
    title: string;
    visibility: "private" | "pending" | "public" | "rejected";
    tags: string[];
    coordinates: [number, number];
  }> = {},
): Promise<{ id: string; _id: Types.ObjectId }> {
  const contribution = await Contribution.create({
    owner,
    kind: overrides.kind ?? "photo",
    title: overrides.title ?? "Cédraie de Tichaou",
    description: "Relevé photographique du peuplement.",
    tags: overrides.tags ?? ["cédraie"],
    visibility: overrides.visibility ?? "private",
    publishedAt: overrides.visibility === "public" ? new Date() : null,
    location: { type: "Point", coordinates: overrides.coordinates ?? [5.9689, 35.5353] },
  });
  return { id: String(contribution._id), _id: contribution._id };
}

/** Charge quelques couches officielles réelles, sans peupler les 20. */
export async function seedLayers(layerIds: string[] = ["boundary", "poste_vigie"]): Promise<void> {
  let order = 0;
  for (const layerId of layerIds) {
    const collection = geojson(layerId);
    if (!collection) continue;
    const stats = summarize(collection);
    await OfficialLayer.create({
      layerId,
      name: layerId === "boundary" ? "Limite du parc" : "Postes de vigie",
      group: layerId === "boundary" ? "Limites" : "Infrastructures",
      type: layerId === "boundary" ? "polygon" : "point",
      color: "#16332A",
      fillOpacity: 0.1,
      weight: 3,
      defaultVisible: layerId === "boundary",
      order: (order += 10),
      geojson: collection,
      featureCount: stats.featureCount,
      bbox: stats.bbox ?? [],
      source: "Shapefiles officiels",
    });
  }
}

export async function seedSpeciesSample(): Promise<void> {
  await Species.insertMany([
    {
      dataset: "flore_uicn",
      kind: "flore_uicn",
      nom_scientifique: "Cedrus atlantica",
      famille: "Pinaceae",
      statut_uicn: "EN",
      order: 0,
    },
    {
      dataset: "flore_uicn",
      kind: "flore_uicn",
      nom_scientifique: "Quercus ilex",
      famille: "Fagaceae",
      statut_uicn: "LC",
      order: 1,
    },
    {
      dataset: "faune_oiseaux_proteges",
      kind: "faune",
      espece: "Aquila chrysaetos",
      famille: "Accipitridae",
      ordre: "Accipitriformes",
      order: 0,
    },
  ]);
}
