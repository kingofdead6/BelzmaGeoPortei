import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Express } from "express";
import { describe } from "vitest";

let memoryServer: MongoMemoryServer | null = null;

/**
 * Résolution de la base de test, par ordre de préférence :
 *   1. `MONGODB_TEST_URI` — une instance MongoDB déjà lancée
 *      (`docker compose up -d` fournit mongodb://127.0.0.1:27017) ;
 *   2. `mongodb-memory-server`, qui télécharge un binaire `mongod`.
 *
 * Le téléchargement est impossible sur un réseau qui bloque
 * fastdl.mongodb.org : les suites d'intégration sont alors ignorées de façon
 * visible plutôt que de faire échouer toute la campagne de tests.
 */
export async function probeDatabase(): Promise<{ available: boolean; reason?: string }> {
  const externalUri = process.env.MONGODB_TEST_URI;
  if (externalUri) {
    try {
      await mongoose.connect(externalUri, { serverSelectionTimeoutMS: 3000 });
      await mongoose.disconnect();
      return { available: true };
    } catch (error) {
      return {
        available: false,
        reason: `MONGODB_TEST_URI injoignable : ${(error as Error).message}`,
      };
    }
  }

  try {
    const server = await MongoMemoryServer.create();
    await server.stop();
    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason:
        `mongodb-memory-server n'a pas pu obtenir de binaire mongod (${(error as Error).message.split("\n")[0]}). ` +
        "Lancez `docker compose up -d` puis exportez MONGODB_TEST_URI=mongodb://127.0.0.1:27017.",
    };
  }
}

const probe = await probeDatabase();

/**
 * `describe` pour les suites qui exigent une base. Ignorée — et signalée comme
 * telle dans le rapport de test — quand aucune instance n'est joignable.
 */
export const describeWithDatabase: typeof describe | typeof describe.skip = probe.available
  ? describe
  : describe.skip;

export const databaseUnavailableReason: string | null = probe.available ? null : (probe.reason ?? null);

export async function startTestDatabase(): Promise<string> {
  const externalUri = process.env.MONGODB_TEST_URI;
  if (externalUri) {
    await mongoose.connect(externalUri, { dbName: `belezma-test-${process.pid}` });
    return externalUri;
  }
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri("belezma-test");
  await mongoose.connect(uri);
  return uri;
}

export async function stopTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  await memoryServer?.stop();
  memoryServer = null;
}

export async function clearDatabase(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function buildTestApp(): Promise<Express> {
  const { createApp } = await import("../../src/app.js");
  return createApp();
}
