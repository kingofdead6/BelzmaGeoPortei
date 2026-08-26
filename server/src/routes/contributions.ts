import { Router } from "express";
import {
  contributionIdParamSchema,
  listContributionsQuerySchema,
} from "@belezma/shared";
import { Contribution } from "../models/index.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate, validatedParams, validatedQuery } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { pageMeta, sendData } from "../utils/respond.js";
import { toContribution } from "../services/serialize.js";
import { buildPublicFilter, buildSort } from "../services/contribution-query.js";
import { isAtLeast } from "../middleware/auth.js";

export const contributionsRouter: Router = Router();

const OWNER_FIELDS = "displayName avatarUrl organization";

/** Fil public — n'expose que `visibility: "public"` (§5). */
contributionsRouter.get(
  "/",
  validate(listContributionsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const query = validatedQuery(req, listContributionsQuerySchema);
    const filter = buildPublicFilter(query);
    const sort = buildSort(query.sort, Boolean(query.q));

    const projection = query.q ? { score: { $meta: "textScore" } } : {};

    const [items, total] = await Promise.all([
      Contribution.find(filter, projection)
        .populate("owner", OWNER_FIELDS)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Contribution.countDocuments(filter),
    ]);

    sendData(res, items.map(toContribution), pageMeta(query.page, query.limit, total));
  }),
);

/**
 * Fiche d'une contribution : publique pour tous, ou réservée au propriétaire
 * et aux modérateurs tant qu'elle ne l'est pas (§5, §13).
 */
contributionsRouter.get(
  "/:id",
  optionalAuth,
  validate(contributionIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);

    const contribution = await Contribution.findById(id).populate("owner", OWNER_FIELDS);
    if (!contribution) throw ApiError.notFound("Cette contribution n'existe pas.");

    const ownerId = String(
      (contribution.owner as unknown as { _id: unknown })._id ?? contribution.owner,
    );
    const viewer = req.auth;
    const isOwner = viewer?.userId === ownerId;
    const isStaff = viewer ? isAtLeast(viewer.role, "moderator") : false;

    if (contribution.visibility !== "public" && !isOwner && !isStaff) {
      // Un identifiant valide ne doit pas révéler l'existence d'une
      // contribution privée : on répond comme pour une ressource absente.
      throw ApiError.notFound("Cette contribution n'existe pas.");
    }

    if (contribution.visibility === "public" && !isOwner) {
      await Contribution.updateOne({ _id: contribution._id }, { $inc: { viewCount: 1 } });
    }

    sendData(res, toContribution(contribution));
  }),
);
