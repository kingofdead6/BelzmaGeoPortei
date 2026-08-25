import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { buildTestApp, describeWithDatabase, startTestDatabase, stopTestDatabase } from "./helpers/test-server.js";

describeWithDatabase("GET /api/v1/health", () => {
  let app: Express;

  beforeAll(async () => {
    await startTestDatabase();
    app = await buildTestApp();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("signale une base connectée", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "ok", database: "connected" });
    expect(response.body.data.timestamp).toBeTypeOf("string");
  });

  it("renvoie une erreur enveloppée sur une adresse inconnue", async () => {
    const response = await request(app).get("/api/v1/inexistant");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body).not.toHaveProperty("stack");
  });
});
