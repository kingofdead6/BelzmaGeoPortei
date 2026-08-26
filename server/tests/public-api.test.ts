import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  buildTestApp,
  clearDatabase,
  describeWithDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./helpers/test-server.js";
import { createContribution, createUser, seedLayers, seedSpeciesSample } from "./helpers/fixtures.js";
import { PARK_AREA_REFERENCE_HA } from "@belezma/shared";

describeWithDatabase("API publique", () => {
  let app: Express;

  beforeAll(async () => {
    await startTestDatabase();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("liste le catalogue officiel sans transporter la géométrie", async () => {
    await seedLayers();

    const response = await request(app).get("/api/v1/layers");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("featureCount");
    // La géométrie n'est servie que par /layers/:layerId/geojson (§9).
    expect(response.body.data[0]).not.toHaveProperty("geojson");
  });

  it("sert la géométrie d'une couche avec cache et ETag", async () => {
    await seedLayers(["boundary"]);

    const first = await request(app).get("/api/v1/layers/boundary/geojson");

    expect(first.status).toBe(200);
    expect(first.headers["cache-control"]).toBe("public, max-age=86400");
    expect(first.headers.etag).toBeTruthy();
    expect(first.body.data.type).toBe("FeatureCollection");
    expect(first.body.data.features).toHaveLength(1);

    const revalidated = await request(app)
      .get("/api/v1/layers/boundary/geojson")
      .set("If-None-Match", first.headers.etag as string);

    expect(revalidated.status).toBe(304);
  });

  it("explique clairement qu'une couche inconnue n'existe pas", async () => {
    const response = await request(app).get("/api/v1/layers/juniperaie/geojson");

    expect(response.status).toBe(404);
    expect(response.body.error.message).toContain("juniperaie");
  });

  it("calcule la superficie du parc depuis la géométrie et non depuis une constante", async () => {
    await seedLayers(["boundary"]);

    const response = await request(app).get("/api/v1/layers/park-stats");

    expect(response.status).toBe(200);
    const { areaHa, perimeterKm, createdYear, mabYear } = response.body.data;
    expect(Math.abs(areaHa - PARK_AREA_REFERENCE_HA) / PARK_AREA_REFERENCE_HA).toBeLessThan(0.02);
    expect(perimeterKm).toBeGreaterThan(150);
    expect(createdYear).toBe(1984);
    expect(mabYear).toBe(2015);
  });

  it("pagine les espèces et filtre par jeu de données", async () => {
    await seedSpeciesSample();

    const all = await request(app).get("/api/v1/species?limit=2");
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, pageCount: 2 });

    const flora = await request(app).get("/api/v1/species?dataset=flore_uicn");
    expect(flora.body.data).toHaveLength(2);
    expect(flora.body.data.every((record: { dataset: string }) => record.dataset === "flore_uicn")).toBe(true);
  });

  it("recherche une espèce par nom partiel", async () => {
    await seedSpeciesSample();

    const response = await request(app).get("/api/v1/species?q=Cedrus");

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].nom_scientifique).toBe("Cedrus atlantica");
    expect(response.body.data[0].statut_uicn).toBe("EN");
  });

  it("plafonne la taille de page à 100", async () => {
    const response = await request(app).get("/api/v1/species?limit=500");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ne publie que les contributions publiques dans le fil", async () => {
    const owner = await createUser();
    await createContribution(owner._id, { visibility: "public", title: "Publiée" });
    await createContribution(owner._id, { visibility: "private", title: "Privée" });
    await createContribution(owner._id, { visibility: "pending", title: "En attente" });
    await createContribution(owner._id, { visibility: "rejected", title: "Refusée" });

    const response = await request(app).get("/api/v1/contributions");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Publiée");
  });

  it("filtre le fil public par emprise géographique", async () => {
    const owner = await createUser();
    await createContribution(owner._id, {
      visibility: "public",
      title: "Dans l'emprise",
      coordinates: [6.0091, 35.5931],
    });
    await createContribution(owner._id, {
      visibility: "public",
      title: "Hors emprise",
      coordinates: [3.0587, 36.7538],
    });

    const response = await request(app).get("/api/v1/contributions?bbox=5.9,35.5,6.31,35.7");

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Dans l'emprise");
  });

  it("refuse une emprise mal formée avec un message utile", async () => {
    const response = await request(app).get("/api/v1/contributions?bbox=6.0,35.6");

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.error.details)).toContain("minLng,minLat,maxLng,maxLat");
  });

  it("sert les points publics de la carte en FeatureCollection", async () => {
    const owner = await createUser();
    await createContribution(owner._id, { visibility: "public", kind: "observation" });
    await createContribution(owner._id, { visibility: "private", kind: "photo" });

    const response = await request(app).get("/api/v1/map/features");

    expect(response.status).toBe(200);
    expect(response.body.data.type).toBe("FeatureCollection");
    expect(response.body.data.features).toHaveLength(1);
    expect(response.body.data.features[0].geometry.type).toBe("Point");
    expect(response.body.data.features[0].properties.kind).toBe("observation");
  });

  it("masque une contribution privée à un visiteur non authentifié", async () => {
    const owner = await createUser();
    const contribution = await createContribution(owner._id, { visibility: "private" });

    const response = await request(app).get(`/api/v1/contributions/${contribution.id}`);

    // Un 404 plutôt qu'un 403 : l'existence même ne doit pas être révélée.
    expect(response.status).toBe(404);
  });

  it("expose une contribution publique à tout visiteur", async () => {
    const owner = await createUser({ displayName: "Amina Bouzid" });
    const contribution = await createContribution(owner._id, { visibility: "public" });

    const response = await request(app).get(`/api/v1/contributions/${contribution.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.owner.displayName).toBe("Amina Bouzid");
    // L'adresse e-mail du contributeur ne doit jamais transiter.
    expect(JSON.stringify(response.body)).not.toContain("@");
  });

  it("refuse un identifiant de contribution mal formé", async () => {
    const response = await request(app).get("/api/v1/contributions/pas-un-identifiant");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
