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
import { Contribution, ModerationLog, Report, User } from "../src/models/index.js";

describeWithDatabase("Modération", () => {
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

  /* --- Accès ---------------------------------------------------------- */

  it("refuse la file de validation à un visiteur non authentifié", async () => {
    const response = await request(app).get("/api/v1/moderation/queue");

    expect(response.status).toBe(401);
  });

  it("refuse la file de validation à un contributeur ordinaire", async () => {
    const user = await createUser({ email: "amina@exemple.dz" });

    const response = await request(app)
      .get("/api/v1/moderation/queue")
      .set("Authorization", `Bearer ${await tokenFor(user.email)}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain("équipe du parc");
  });

  it("refuse l'administration à un modérateur", async () => {
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });

    const response = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(403);
  });

  /* --- File de validation --------------------------------------------- */

  it("ne liste que les contributions en attente, du plus ancien au plus récent", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });

    const first = await createContribution(author._id, {
      visibility: "pending",
      title: "Déposée en premier",
    });
    await Contribution.updateOne(
      { _id: first._id },
      { $set: { updatedAt: new Date("2026-01-01") } },
      { timestamps: false },
    );
    await createContribution(author._id, { visibility: "pending", title: "Déposée ensuite" });
    await createContribution(author._id, { visibility: "private", title: "Privée" });
    await createContribution(author._id, { visibility: "public", title: "Publiée" });

    const response = await request(app)
      .get("/api/v1/moderation/queue")
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].title).toBe("Déposée en premier");
  });

  /* --- Approbation ----------------------------------------------------- */

  it("publie une contribution et incrémente le compteur de son auteur", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "pending" });

    const response = await request(app)
      .post(`/api/v1/moderation/${item.id}/approve`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("public");
    expect(response.body.data.publishedAt).not.toBeNull();

    const refreshed = await User.findById(author._id).lean();
    expect(refreshed?.stats.published).toBe(1);

    // Elle apparaît aussitôt dans le fil public.
    const feed = await request(app).get("/api/v1/contributions");
    expect(feed.body.data).toHaveLength(1);
  });

  it("empêche un modérateur de valider sa propre contribution", async () => {
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const own = await createContribution(moderator._id, { visibility: "pending" });

    const response = await request(app)
      .post(`/api/v1/moderation/${own.id}/approve`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain("administrateur");

    const unchanged = await Contribution.findById(own.id).lean();
    expect(unchanged?.visibility).toBe("pending");
  });

  it("permet à un administrateur de valider la contribution d'un modérateur", async () => {
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    const item = await createContribution(moderator._id, { visibility: "pending" });

    const response = await request(app)
      .post(`/api/v1/moderation/${item.id}/approve`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("public");
  });

  it("permet à un administrateur de valider sa propre contribution", async () => {
    const admin = await createUser({ email: "admin@belezma.dz", role: "admin" });
    const own = await createContribution(admin._id, { visibility: "pending" });

    const response = await request(app)
      .post(`/api/v1/moderation/${own.id}/approve`)
      .set("Authorization", `Bearer ${await tokenFor(admin.email)}`);

    expect(response.status).toBe(200);
  });

  it("refuse de publier une contribution qui n'est pas en attente", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "private" });

    const response = await request(app)
      .post(`/api/v1/moderation/${item.id}/approve`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`);

    expect(response.status).toBe(409);
  });

  /* --- Refus ----------------------------------------------------------- */

  it("exige un motif de refus d'au moins dix caractères", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "pending" });
    const token = await tokenFor(moderator.email);

    const tooShort = await request(app)
      .post(`/api/v1/moderation/${item.id}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "non" });
    expect(tooShort.status).toBe(400);

    const missing = await request(app)
      .post(`/api/v1/moderation/${item.id}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(missing.status).toBe(400);
  });

  it("transmet le motif du refus au contributeur", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "pending" });
    const reason =
      "La photographie ne montre pas le Parc National de Belezma : le cadrage porte sur la zone urbaine de Batna.";

    const response = await request(app)
      .post(`/api/v1/moderation/${item.id}/reject`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`)
      .send({ reason });

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("rejected");
    expect(response.body.data.rejectedReason).toBe(reason);

    // Le motif est lisible par l'auteur depuis son espace (§13).
    const mine = await request(app)
      .get("/api/v1/contributions/mine?visibility=rejected")
      .set("Authorization", `Bearer ${await tokenFor(author.email)}`);
    expect(mine.body.data[0].rejectedReason).toBe(reason);
  });

  /* --- Retrait de publication ------------------------------------------ */

  it("retire une contribution publiée et ajuste le compteur", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "public" });
    await User.updateOne({ _id: author._id }, { $set: { "stats.published": 1 } });

    const response = await request(app)
      .post(`/api/v1/moderation/${item.id}/unpublish`)
      .set("Authorization", `Bearer ${await tokenFor(moderator.email)}`)
      .send({ reason: "Signalement confirmé : la détermination de l'espèce est erronée." });

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("rejected");

    const refreshed = await User.findById(author._id).lean();
    expect(refreshed?.stats.published).toBe(0);

    const feed = await request(app).get("/api/v1/contributions");
    expect(feed.body.data).toHaveLength(0);
  });

  /* --- Journal d'audit -------------------------------------------------- */

  it("consigne chaque décision avec son instantané", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const approved = await createContribution(author._id, {
      visibility: "pending",
      title: "Cédraie de Tichaou",
    });
    const rejected = await createContribution(author._id, {
      visibility: "pending",
      title: "Vue depuis la route",
    });
    const token = await tokenFor(moderator.email);

    await request(app)
      .post(`/api/v1/moderation/${approved.id}/approve`)
      .set("Authorization", `Bearer ${token}`);
    await request(app)
      .post(`/api/v1/moderation/${rejected.id}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Le cadrage porte sur la zone urbaine de Batna." });

    const response = await request(app)
      .get("/api/v1/moderation/log")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].actor.displayName).toBeTypeOf("string");
    expect(response.body.data.map((entry: { action: string }) => entry.action).sort()).toEqual([
      "approve",
      "reject",
    ]);

    const rejectEntry = response.body.data.find(
      (entry: { action: string }) => entry.action === "reject",
    );
    expect(rejectEntry.reason).toContain("zone urbaine");
    expect(rejectEntry.snapshot.title).toBe("Vue depuis la route");
  });

  it("filtre le journal par type de décision", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "pending" });
    const token = await tokenFor(moderator.email);

    await request(app)
      .post(`/api/v1/moderation/${item.id}/approve`)
      .set("Authorization", `Bearer ${token}`);

    const approvals = await request(app)
      .get("/api/v1/moderation/log?action=approve")
      .set("Authorization", `Bearer ${token}`);
    expect(approvals.body.data).toHaveLength(1);

    const rejections = await request(app)
      .get("/api/v1/moderation/log?action=reject")
      .set("Authorization", `Bearer ${token}`);
    expect(rejections.body.data).toHaveLength(0);
  });

  it("n'autorise aucune route à modifier le journal", async () => {
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const token = await tokenFor(moderator.email);

    // Le journal est en ajout seul : aucune route de suppression n'existe.
    const response = await request(app)
      .delete("/api/v1/moderation/log")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(await ModerationLog.countDocuments()).toBe(0);
  });

  /* --- Signalements ----------------------------------------------------- */

  it("liste les signalements ouverts puis les clôt", async () => {
    const author = await createUser({ email: "amina@exemple.dz" });
    const reporter = await createUser({ email: "karim@exemple.dz" });
    const moderator = await createUser({ email: "moderation@belezma.dz", role: "moderator" });
    const item = await createContribution(author._id, { visibility: "public" });

    await request(app)
      .post(`/api/v1/contributions/${item.id}/report`)
      .set("Authorization", `Bearer ${await tokenFor(reporter.email)}`)
      .send({ reason: "donnee_erronee", note: "La date ne correspond pas." });

    const token = await tokenFor(moderator.email);
    const open = await request(app)
      .get("/api/v1/moderation/reports")
      .set("Authorization", `Bearer ${token}`);

    expect(open.status).toBe(200);
    expect(open.body.data).toHaveLength(1);
    expect(open.body.data[0].contribution.title).toBeTypeOf("string");
    expect(open.body.data[0].reporter.displayName).toBeTypeOf("string");

    const closed = await request(app)
      .post(`/api/v1/moderation/reports/${open.body.data[0].id}/close`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "Date corrigée avec l'auteur." });
    expect(closed.status).toBe(200);

    const stillOpen = await request(app)
      .get("/api/v1/moderation/reports")
      .set("Authorization", `Bearer ${token}`);
    expect(stillOpen.body.data).toHaveLength(0);
    expect(await Report.countDocuments({ status: "closed" })).toBe(1);
  });
});
