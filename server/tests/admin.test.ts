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
import {
  createContribution,
  createUser,
  seedLayers,
  TEST_PASSWORD,
} from "./helpers/fixtures.js";
import { ModerationLog, OfficialLayer, RefreshToken, User } from "../src/models/index.js";

describeWithDatabase("Administration", () => {
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

  async function tokenFor(email: string): Promise<string> {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: TEST_PASSWORD });
    return response.body.data.accessToken as string;
  }

  /* --- Comptes ---------------------------------------------------------- */

  it("liste les comptes avec leur adresse, réservée à l'administration", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    await createUser({ email: "amina@exemple.dz", displayName: "Amina Bouzid" });

    const response = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(JSON.stringify(response.body)).toContain("amina@exemple.dz");
  });

  it("recherche un compte par nom ou par adresse", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    await createUser({ email: "amina@exemple.dz", displayName: "Amina Bouzid" });
    await createUser({ email: "karim@exemple.dz", displayName: "Karim Lounis" });
    const token = await tokenFor(admin.email);

    const byName = await request(app)
      .get("/api/v1/admin/users?q=Bouzid")
      .set("Authorization", `Bearer ${token}`);
    expect(byName.body.data).toHaveLength(1);

    const byEmail = await request(app)
      .get("/api/v1/admin/users?q=karim@")
      .set("Authorization", `Bearer ${token}`);
    expect(byEmail.body.data).toHaveLength(1);
  });

  it("promeut un compte et ferme ses sessions", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    const user = await createUser({ email: "amina@exemple.dz" });

    // Le compte ouvre une session avant la promotion.
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(1);

    const response = await request(app)
      .patch(`/api/v1/admin/users/${user.id}/role`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({ role: "moderator" });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe("moderator");
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(0);

    const logged = await ModerationLog.findOne({ action: "role_change" }).lean();
    expect(logged?.reason).toBe("user → moderator");
  });

  it("empêche un administrateur de modifier son propre rôle", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${admin.id}/role`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({ role: "user" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("votre propre rôle");
    const unchanged = await User.findById(admin._id).lean();
    expect(unchanged?.role).toBe("admin");
  });

  it("refuse un rôle inconnu", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    const user = await createUser({ email: "amina@exemple.dz" });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${user.id}/role`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({ role: "superadmin" });

    expect(response.status).toBe(400);
  });

  it("suspend un compte, ferme ses sessions et consigne la décision", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    const user = await createUser({ email: "amina@exemple.dz" });

    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${user.id}/status`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({ status: "suspended", reason: "Dépôts répétés sans rapport avec le parc." });

    expect(response.status).toBe(200);
    expect(response.body.meta.message).toContain("suspendu");
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(0);

    const logged = await ModerationLog.findOne({ action: "suspend_user" }).lean();
    expect(logged?.reason).toContain("sans rapport");

    // La session ne peut plus être rafraîchie.
    const refresh = await agent.post("/api/v1/auth/refresh");
    expect(refresh.status).toBe(401);
  });

  it("empêche un administrateur de suspendre son propre compte", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${admin.id}/status`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({ status: "suspended" });

    expect(response.status).toBe(400);
  });

  /* --- Statistiques ----------------------------------------------------- */

  it("rend compte des comptes, des contributions et de la file", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    const author = await createUser({ email: "amina@exemple.dz" });
    await seedLayers(["boundary"]);
    await createContribution(author._id, { visibility: "public", kind: "photo" });
    await createContribution(author._id, { visibility: "pending", kind: "observation" });
    await createContribution(author._id, { visibility: "private", kind: "photo" });

    const response = await request(app)
      .get("/api/v1/admin/stats")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`);

    expect(response.status).toBe(200);
    const stats = response.body.data;
    expect(stats.users.total).toBe(2);
    expect(stats.users.byRole).toMatchObject({ admin: 1, user: 1 });
    expect(stats.contributions.total).toBe(3);
    expect(stats.contributions.byVisibility).toMatchObject({ public: 1, pending: 1, private: 1 });
    expect(stats.contributions.byKind).toMatchObject({ photo: 2, observation: 1 });
    expect(stats.queue.pending).toBe(1);
    expect(stats.queue.oldestPendingAt).toBeTypeOf("string");
    expect(stats.layers.official).toBe(1);
    expect(Array.isArray(stats.uploadsPerWeek)).toBe(true);
    expect(stats.uploadsPerWeek[0].week).toMatch(/^\d{4}-S\d{2}$/);
  });

  /* --- Catalogue officiel ------------------------------------------------ */

  it("ajoute une couche au catalogue et en compte les entités", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });

    const response = await request(app)
      .post("/api/v1/admin/layers")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({
        layerId: "juniperaie",
        name: "Junipéraie",
        group: "Végétation",
        type: "polygon",
        color: "#6B8E23",
        fillOpacity: 0.45,
        weight: 1,
        geojson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { OCCUPATION: "JUNIPERAIE" },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [6.0, 35.58],
                    [6.02, 35.58],
                    [6.02, 35.6],
                    [6.0, 35.6],
                    [6.0, 35.58],
                  ],
                ],
              },
            },
          ],
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.featureCount).toBe(1);

    // Elle est aussitôt servie au catalogue public, géométrie à la demande.
    const catalog = await request(app).get("/api/v1/layers");
    expect(catalog.body.data.some((layer: { layerId: string }) => layer.layerId === "juniperaie")).toBe(
      true,
    );
    const geometry = await request(app).get("/api/v1/layers/juniperaie/geojson");
    expect(geometry.body.data.features).toHaveLength(1);
  });

  it("refuse un identifiant de couche déjà pris", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    await seedLayers(["boundary"]);

    const response = await request(app)
      .post("/api/v1/admin/layers")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({
        layerId: "boundary",
        name: "Doublon",
        group: "Limites",
        type: "polygon",
        color: "#16332A",
        fillOpacity: 0.1,
        weight: 3,
        geojson: { type: "FeatureCollection", features: [] },
      });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain("boundary");
  });

  it("met à jour le style d'une couche sans toucher à sa géométrie", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    await seedLayers(["poste_vigie"]);

    const response = await request(app)
      .patch("/api/v1/admin/layers/poste_vigie")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({ color: "#7B241C", defaultVisible: true });

    expect(response.status).toBe(200);
    const layer = await OfficialLayer.findOne({ layerId: "poste_vigie" }).lean();
    expect(layer?.color).toBe("#7B241C");
    expect(layer?.defaultVisible).toBe(true);
    expect(layer?.featureCount).toBe(3);
  });

  it("protège la limite officielle contre la suppression", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    await seedLayers(["boundary"]);

    const response = await request(app)
      .delete("/api/v1/admin/layers/boundary")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("superficie");
    expect(await OfficialLayer.countDocuments({ layerId: "boundary" })).toBe(1);
  });

  it("supprime une autre couche et consigne la décision", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    await seedLayers(["boundary", "poste_vigie"]);

    const response = await request(app)
      .delete("/api/v1/admin/layers/poste_vigie")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`);

    expect(response.status).toBe(200);
    expect(await OfficialLayer.countDocuments({ layerId: "poste_vigie" })).toBe(0);

    const logged = await ModerationLog.findOne({ action: "delete" }).lean();
    expect((logged?.snapshot as { layerId?: string } | null)?.layerId).toBe("poste_vigie");
  });

  it("refuse un GeoJSON invalide à l'ajout d'une couche", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });

    const response = await request(app)
      .post("/api/v1/admin/layers")
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`)
      .send({
        layerId: "anneau_ouvert",
        name: "Anneau ouvert",
        group: "Végétation",
        type: "polygon",
        color: "#6B8E23",
        fillOpacity: 0.4,
        weight: 1,
        geojson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                // Anneau non fermé : la dernière position ne répète pas la première.
                coordinates: [
                  [
                    [6.0, 35.58],
                    [6.02, 35.58],
                    [6.02, 35.6],
                    [6.0, 35.6],
                  ],
                ],
              },
            },
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.error.details)).toContain("fermé");
  });
});
