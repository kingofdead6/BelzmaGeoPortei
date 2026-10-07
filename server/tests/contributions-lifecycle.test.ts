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

describeWithDatabase("Partage et retrait d'une contribution", () => {
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

  it("fait passer une contribution privée en attente de validation", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "private" });

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/share`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("pending");
    expect(response.body.meta.message).toContain("examinera");
  });

  it("efface le motif de refus quand l'auteur soumet à nouveau", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "rejected" });
    await Contribution.updateOne(
      { _id: item._id },
      { $set: { rejectedReason: "Le cadrage porte sur la zone urbaine de Batna." } },
    );

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/share`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.rejectedReason).toBeNull();
  });

  it("refuse de demander deux fois la publication", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "pending" });

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/share`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain("déjà");
  });

  it("exige une localisation pour publier un site patrimonial", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, {
      kind: "heritage",
      visibility: "private",
    });
    await Contribution.updateOne({ _id: item._id }, { $set: { location: null } });

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/share`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("Localisez ce site");
  });

  it("retire une contribution publiée et ajuste le compteur du compte", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "public" });
    await User.updateOne({ _id: owner._id }, { $set: { "stats.published": 1 } });

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/unshare`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("private");

    const refreshed = await User.findById(owner._id).lean();
    expect(refreshed?.stats.published).toBe(0);

    // Elle disparaît immédiatement du fil public.
    const feed = await request(app).get("/api/v1/contributions");
    expect(feed.body.data).toHaveLength(0);
  });

  it("renvoie en validation une contribution publiée que l'auteur modifie", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "public" });

    const response = await request(app)
      .patch(`/api/v1/contributions/${item.id}`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`)
      .send({ title: "Cédraie de Tichaou, versant nord" });

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("pending");
    expect(response.body.data.publishedAt).toBeNull();
    expect(response.body.meta.returnedToReview).toBe(true);
    expect(response.body.meta.message).toContain("repasse en validation");
  });

  it("ne renvoie pas en validation la modification d'une contribution privée", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "private" });

    const response = await request(app)
      .patch(`/api/v1/contributions/${item.id}`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`)
      .send({ description: "Relevé complété après une seconde visite." });

    expect(response.status).toBe(200);
    expect(response.body.data.visibility).toBe("private");
    expect(response.body.meta.returnedToReview).toBe(false);
  });

  it("refuse les champs inconnus dans une modification", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "private" });

    const response = await request(app)
      .patch(`/api/v1/contributions/${item.id}`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`)
      // Un auteur ne peut pas se publier lui-même en forçant le champ.
      .send({ visibility: "public" });

    expect(response.status).toBe(400);
    const unchanged = await Contribution.findById(item.id).lean();
    expect(unchanged?.visibility).toBe("private");
  });

  it("compte les contributions par état pour le tableau de bord", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    await createContribution(owner._id, { visibility: "private" });
    await createContribution(owner._id, { visibility: "private" });
    await createContribution(owner._id, { visibility: "pending" });
    await createContribution(owner._id, { visibility: "public" });

    const response = await request(app)
      .get("/api/v1/contributions/mine")
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.body.meta.counts).toEqual({ private: 2, pending: 1, public: 1 });
  });

  it("filtre les contributions du compte par état", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    await createContribution(owner._id, { visibility: "private", title: "Brouillon" });
    await createContribution(owner._id, { visibility: "public", title: "Publiée" });

    const response = await request(app)
      .get("/api/v1/contributions/mine?visibility=public")
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Publiée");
  });

  it("enregistre un signalement une seule fois par personne", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const reporter = await createUser({ email: "karim@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "public" });
    const token = await tokenFor(reporter.email);

    const first = await request(app)
      .post(`/api/v1/contributions/${item.id}/report`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        reason: "donnee_erronee",
        note: "La date ne correspond pas à l'épisode neigeux décrit.",
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/contributions/${item.id}/report`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "donnee_erronee" });
    expect(second.status).toBe(409);

    const flagged = await Contribution.findById(item.id).lean();
    expect(flagged?.flagCount).toBe(1);
  });

  it("empêche de signaler sa propre contribution", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "public" });

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/report`)
      .set("Authorization", `Bearer ${await tokenFor(owner.email)}`)
      .send({ reason: "autre" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("votre propre");
  });

  it("empêche de signaler une contribution non publiée", async () => {
    const owner = await createUser({ email: "amina@exemple.dz" });
    const reporter = await createUser({ email: "karim@exemple.dz" });
    const item = await createContribution(owner._id, { visibility: "private" });

    const response = await request(app)
      .post(`/api/v1/contributions/${item.id}/report`)
      .set("Authorization", `Bearer ${await tokenFor(reporter.email)}`)
      .send({ reason: "autre" });

    expect(response.status).toBe(404);
  });
});
