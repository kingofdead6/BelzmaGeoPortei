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
import { createUser, TEST_PASSWORD } from "./helpers/fixtures.js";
import { User } from "../src/models/index.js";

describeWithDatabase("Authentification", () => {
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

  const credentials = {
    email: "amina.bouzid@exemple.dz",
    password: "un-mot-de-passe-solide",
    displayName: "Amina Bouzid",
  };

  it("crée un compte et ouvre une session", async () => {
    const response = await request(app).post("/api/v1/auth/register").send(credentials);

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(credentials.email);
    expect(response.body.data.user.role).toBe("user");
    expect(response.body.data.accessToken).toBeTypeOf("string");

    // Le jeton de rafraîchissement ne circule que par un cookie httpOnly (§6).
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const refresh = cookies.find((cookie) => cookie.startsWith("belezma_refresh="));
    expect(refresh).toContain("HttpOnly");
    expect(refresh).toContain("SameSite=Strict");
    expect(JSON.stringify(response.body)).not.toContain("belezma_refresh");
  });

  it("ne renvoie jamais le hachage du mot de passe", async () => {
    const response = await request(app).post("/api/v1/auth/register").send(credentials);

    expect(JSON.stringify(response.body)).not.toContain("$2b$");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("refuse un mot de passe de moins de dix caractères", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...credentials, password: "court" });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.error.details)).toContain("10 caractères");
  });

  it("refuse les champs inconnus", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...credentials, role: "admin" });

    expect(response.status).toBe(400);
    // Une élévation de privilège par le corps de la requête est impossible.
    const created = await User.findOne({ email: credentials.email }).lean();
    expect(created).toBeNull();
  });

  it("refuse une adresse déjà enregistrée", async () => {
    await request(app).post("/api/v1/auth/register").send(credentials);
    const response = await request(app).post("/api/v1/auth/register").send(credentials);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain("existe déjà");
  });

  it("connecte un compte existant", async () => {
    const user = await createUser({ email: "karim@exemple.dz" });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(user.id);
  });

  it("donne le même message pour une adresse inconnue et un mot de passe erroné", async () => {
    const user = await createUser({ email: "karim@exemple.dz" });

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "un-autre-mot-de-passe" });
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "inconnu@exemple.dz", password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it("refuse la connexion d'un compte suspendu en expliquant la marche à suivre", async () => {
    const user = await createUser({ email: "suspendu@exemple.dz", status: "suspended" });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain("suspendu");
  });

  it("renvoie le compte courant sur /auth/me", async () => {
    const { accessToken } = await registerAndLogin(app, credentials);

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(credentials.email);
  });

  it("refuse /auth/me sans jeton", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("refuse un jeton d'accès falsifié", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.falsifie.signature");

    expect(response.status).toBe(401);
  });

  it("fait tourner le jeton de rafraîchissement à chaque usage", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/register").send(credentials);

    const first = await agent.post("/api/v1/auth/refresh");
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTypeOf("string");

    const second = await agent.post("/api/v1/auth/refresh");
    expect(second.status).toBe(200);
  });

  it("révoque toute la famille quand un jeton déjà consommé est rejoué", async () => {
    const agent = request.agent(app);
    const registration = await agent.post("/api/v1/auth/register").send(credentials);
    const original = extractRefreshToken(registration.headers["set-cookie"] as unknown as string[]);

    // Usage normal : le jeton tourne.
    await agent.post("/api/v1/auth/refresh");

    // Rejeu du jeton d'origine : détection de réutilisation (§6).
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `belezma_refresh=${original}`);
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toContain("sécurité");

    // La session légitime est invalidée elle aussi : la famille entière tombe.
    const afterRevocation = await agent.post("/api/v1/auth/refresh");
    expect(afterRevocation.status).toBe(401);
  });

  it("rend la déconnexion effective côté serveur", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/register").send(credentials);

    const logout = await agent.post("/api/v1/auth/logout");
    expect(logout.status).toBe(200);

    const afterLogout = await agent.post("/api/v1/auth/refresh");
    expect(afterLogout.status).toBe(401);
  });

  it("répond la même chose pour une adresse connue et inconnue en cas d'oubli", async () => {
    await createUser({ email: "connue@exemple.dz" });

    const known = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "connue@exemple.dz" });
    const unknown = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "jamais-vue@exemple.dz" });

    expect(known.status).toBe(200);
    expect(known.body.data.message).toBe(unknown.body.data.message);
  });

  it("refuse un jeton de réinitialisation inconnu", async () => {
    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: "jeton-inexistant-mais-assez-long", password: "un-nouveau-mot-de-passe" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("expiré ou déjà utilisé");
  });
});

async function registerAndLogin(
  app: Express,
  credentials: { email: string; password: string; displayName: string },
): Promise<{ accessToken: string }> {
  const response = await request(app).post("/api/v1/auth/register").send(credentials);
  return { accessToken: response.body.data.accessToken as string };
}

function extractRefreshToken(cookies: string[]): string {
  const cookie = cookies.find((value) => value.startsWith("belezma_refresh="));
  return cookie?.split(";")[0]?.split("=")[1] ?? "";
}
