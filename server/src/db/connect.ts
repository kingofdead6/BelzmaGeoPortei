import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

mongoose.set("strictQuery", true);
// Les requêtes échouent vite plutôt que de s'empiler si la base est absente.
mongoose.set("bufferTimeoutMS", 10_000);

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  connecting = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      autoIndex: !env.isProduction,
    })
    .then((connection) => {
      logger.info({ host: connection.connection.host, db: connection.connection.name }, "MongoDB connecté");
      return connection;
    })
    .catch((error: unknown) => {
      connecting = null;
      throw error;
    });

  return connecting;
}

export async function disconnectDatabase(): Promise<void> {
  connecting = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function databaseState(): "disconnected" | "connected" | "connecting" | "disconnecting" | "unknown" {
  const states: Record<number, "disconnected" | "connected" | "connecting" | "disconnecting"> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] ?? "unknown";
}
