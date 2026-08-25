import { Router } from "express";
import { databaseState } from "../db/connect.js";
import { sendData } from "../utils/respond.js";

export const healthRouter: Router = Router();

healthRouter.get("/", (req, res) => {
  const database = databaseState();
  const healthy = database === "connected";
  sendData(
    res,
    {
      status: healthy ? "ok" : "degraded",
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      requestId: req.id ?? null,
    },
    undefined,
    healthy ? 200 : 503,
  );
});
