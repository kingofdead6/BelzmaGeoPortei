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
import { createContribution, createUser, TEST_PASSWORD } from "./helpers/fixtures.js";
import { Contribution, User } from "../src/models/index.js";

describeWithDatabase("Cloisonnement entre comptes", () => {
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

  it("empêche un utilisateur de lire la contribution privée d'un autre", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const bob = await createUser({ email: "bob@exemple.dz" });
    const secret = await createContribution(alice._id, {
      visibility: "private",
      title: "Cliché privé",
    });

    const response = await request(app)
      .get(`/api/v1/contributions/${secret.id}`)
      .set("Authorization", `Bearer ${await tokenFor(bob.email)}`);

    // Un 404 plutôt qu'un 403 : l'existence même ne doit pas être révélée.
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain("Cliché privé");
  });

  it("laisse le propriétaire lire sa propre contribution privée", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const secret = await createContribution(alice._id, {
      visibility: "private",
      title: "Cliché privé",
    });

    const response = await request(app)
      .get(`/api/v1/contributions/${secret.id}`)
      .set("Authorization", `Bearer ${await tokenFor(alice.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Cliché privé");
  });

  it("laisse un modérateur lire une contribution en attente", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const pending = await createContribution(alice._id, { visibility: "pending" });

    const response = await request(app)
      .get(`/api/v1/contributions/${pending.id}`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(200);
  });

  it("empêche un utilisateur de modifier la contribution d'un autre", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const bob = await createUser({ email: "bob@exemple.dz" });
    const target = await createContribution(alice._id, { visibility: "public" });

    const response = await request(app)
      .patch(`/api/v1/contributions/${target.id}`)
      .set("Authorization", `Bearer ${await tokenFor(bob.email)}`)
      .send({ title: "Titre détourné" });

    expect(response.status).toBe(404);
    const unchanged = await Contribution.findById(target.id).lean();
    expect(unchanged?.title).not.toBe("Titre détourné");
  });

  it("empêche un utilisateur de supprimer la contribution d'un autre", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const bob = await createUser({ email: "bob@exemple.dz" });
    const target = await createContribution(alice._id, { visibility: "public" });

    const response = await request(app)
      .delete(`/api/v1/contributions/${target.id}`)
      .set("Authorization", `Bearer ${await tokenFor(bob.email)}`);

    expect(response.status).toBe(404);
    expect(await Contribution.findById(target.id).lean()).not.toBeNull();
  });

  it("autorise un modérateur à supprimer la contribution d'un tiers", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const target = await createContribution(alice._id, { visibility: "public" });

    const response = await request(app)
      .delete(`/api/v1/contributions/${target.id}`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(200);
    expect(await Contribution.findById(target.id).lean()).toBeNull();
  });

  it("empêche un utilisateur de partager la contribution d'un autre", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const bob = await createUser({ email: "bob@exemple.dz" });
    const target = await createContribution(alice._id, { visibility: "private" });

    const response = await request(app)
      .post(`/api/v1/contributions/${target.id}/share`)
      .set("Authorization", `Bearer ${await tokenFor(bob.email)}`);

    expect(response.status).toBe(404);
    const unchanged = await Contribution.findById(target.id).lean();
    expect(unchanged?.visibility).toBe("private");
  });

  it("ne montre à chacun que ses propres contributions dans /mine", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const bob = await createUser({ email: "bob@exemple.dz" });
    await createContribution(alice._id, { title: "Chez Alice" });
    await createContribution(bob._id, { title: "Chez Bob" });

    const response = await request(app)
      .get("/api/v1/contributions/mine")
      .set("Authorization", `Bearer ${await tokenFor(bob.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Chez Bob");
  });

  it("refuse /mine à un visiteur non authentifié", async () => {
    const response = await request(app).get("/api/v1/contributions/mine");

    expect(response.status).toBe(401);
  });

  it("n'expose que les contributions publiques sur un profil public", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    await createContribution(alice._id, { visibility: "public", title: "Visible" });
    await createContribution(alice._id, { visibility: "private", title: "Invisible" });

    const response = await request(app).get(`/api/v1/users/${alice.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.contributions).toHaveLength(1);
    expect(response.body.data.contributions[0].title).toBe("Visible");
    // L'adresse e-mail ne figure jamais sur un profil public.
    expect(JSON.stringify(response.body)).not.toContain("alice@exemple.dz");
  });

  it("empêche un compte suspendu d'agir, même avec un jeton encore valable", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const token = await tokenFor(alice.email);

    // Le rôle et le statut sont relus en base à chaque requête (§6).
    await User.updateOne({ _id: alice._id }, { $set: { status: "suspended" } });

    const response = await request(app)
      .get("/api/v1/contributions/mine")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain("suspendu");
  });

  it("refuse une élévation de privilège par le corps de la requête", async () => {
    const alice = await createUser({ email: "alice@exemple.dz" });
    const token = await tokenFor(alice.email);

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Alice", role: "admin" });

    expect(response.status).toBe(400);
    const unchanged = await User.findById(alice._id).lean();
    expect(unchanged?.role).toBe("user");
  });
});
