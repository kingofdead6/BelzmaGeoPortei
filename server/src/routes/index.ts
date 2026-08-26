import { Router } from "express";
import { healthRouter } from "./health.js";
import { layersRouter } from "./layers.js";
import { speciesRouter } from "./species.js";
import { contributionsRouter } from "./contributions.js";
import { mapRouter } from "./map.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/layers", layersRouter);
apiRouter.use("/species", speciesRouter);
apiRouter.use("/contributions", contributionsRouter);
apiRouter.use("/map", mapRouter);
