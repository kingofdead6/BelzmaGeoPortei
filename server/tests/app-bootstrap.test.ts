import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { databaseUnavailableReason } from "./helpers/test-server.js";

/** Ces contrôles ne dépendent pas de MongoDB et s'exécutent partout. */
describe("Amorçage de l'application", () => {
  const app = createApp();

  it("signale une base déconnectée avec le statut 503", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(503);
    expect(response.body.data).toMatchObject({ status: "degraded", database: "disconnected" });
  });

  it("attribue un identifiant de requête à chaque réponse", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("n'annonce pas la technologie du serveur", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("pose les en-têtes de sécurité de helmet", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("refuse une origine absente de la liste blanche", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://exemple-non-autorise.test");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("autorise l'origine du client déclarée dans l'environnement", async () => {
    const response = await request(app).get("/api/v1/health").set("Origin", "http://localhost:5173");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejette un corps JSON malformé sans divulguer de pile d'appels", async () => {
    const response = await request(app)
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send('{"incomplet":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("at ");
  });

  it("documente l'absence éventuelle de MongoDB pour les suites d'intégration", () => {
    // Ce test ne juge rien : il rend la raison du saut visible dans le rapport.
    expect(databaseUnavailableReason === null || typeof databaseUnavailableReason === "string").toBe(true);
  });
});
