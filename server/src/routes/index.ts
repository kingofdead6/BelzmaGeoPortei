import { Router } from "express";
import { healthRouter } from "./health.js";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { layersRouter } from "./layers.js";
import { speciesRouter } from "./species.js";
import { contributionsRouter } from "./contributions.js";
import { contributionsWriteRouter, uploadsRouter } from "./contributions-write.js";
import { mapRouter } from "./map.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/layers", layersRouter);
apiRouter.use("/species", speciesRouter);
// Les routes authentifiées passent en premier : /contributions/mine ne doit
// pas être capté par /contributions/:id.
apiRouter.use("/contributions", contributionsWriteRouter);
apiRouter.use("/contributions", contributionsRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/map", mapRouter);
