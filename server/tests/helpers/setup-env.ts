import { config as loadDotenv } from "dotenv";
import { fileURLToPath, URL } from "node:url";

/** Charge `.env.test` avant que `src/config/env.ts` ne lise `process.env`. */
loadDotenv({ path: fileURLToPath(new URL("../../.env.test", import.meta.url)), override: true });
