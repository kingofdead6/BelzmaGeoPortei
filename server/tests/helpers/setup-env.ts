import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

/**
 * Environnement des tests, appliqué avant que `src/config/env.ts` ne lise
 * `process.env`. Les valeurs sont renseignées ici plutôt que dans un fichier
 * ignoré par git, afin que la campagne de tests démarre sur un dépôt frais.
 *
 * Ce ne sont pas des secrets : elles ne servent qu'à signer des jetons de
 * test, dans une base éphémère détruite à la fin de la campagne.
 */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/belezma-test",
  JWT_ACCESS_SECRET: "jeton-acces-de-test-au-moins-32-caracteres",
  JWT_REFRESH_SECRET: "jeton-rafraichissement-de-test-32-caracteres",
  CLIENT_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}

// Un `.env.test` local, s'il existe, prime : il permet de pointer vers une
// instance MongoDB réelle sans toucher au dépôt.
const localEnv = fileURLToPath(new URL("../../.env.test", import.meta.url));
if (existsSync(localEnv)) {
  loadDotenv({ path: localEnv, override: true });
}
