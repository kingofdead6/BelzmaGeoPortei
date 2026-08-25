import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./db/connect.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function start(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "API Géoportail Belezma démarrée");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Arrêt en cours");
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    // Filet de sécurité si des connexions restent ouvertes.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Démarrage impossible");
  process.exit(1);
});
