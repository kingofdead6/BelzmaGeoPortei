import { Router } from "express";
import { healthRouter } from "./health.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
