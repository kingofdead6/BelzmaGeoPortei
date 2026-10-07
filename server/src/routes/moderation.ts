import { Router } from "express";
import type { FilterQuery } from "mongoose";
import {
  closeReportSchema,
  contributionIdParamSchema,
  idParamSchema,
  listModerationLogQuerySchema,
  listReportsQuerySchema,
  moderationQueueQuerySchema,
  rejectContributionSchema,
  unpublishContributionSchema,
} from "@belezma/shared";
import {
  Contribution,
  ModerationLog,
  Report,
  User,
  type ContributionAttributes,
} from "../models/index.js";
import { isAtLeast, requireAuth, requireRole } from "../middleware/auth.js";
import { validate, validatedParams, validatedQuery } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";
import { pageMeta, sendData } from "../utils/respond.js";
import { toContribution } from "../services/serialize.js";
import { assertTransition } from "../services/contribution-lifecycle.js";
import { sendApprovalEmail, sendRejectionEmail } from "../services/mailer.js";
import { record } from "../services/moderation-log.js";

export const moderationRouter: Router = Router();

const OWNER_FIELDS = "displayName avatarUrl organization email";

moderationRouter.use(requireAuth, requireRole("moderator"));

/** File de validation, du plus ancien au plus récent par défaut (§8). */
moderationRouter.get(
  "/queue",
  validate(moderationQueueQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { kind, sort, page, limit } = validatedQuery(req, moderationQueueQuerySchema);

    const filter: FilterQuery<ContributionAttributes> = { visibility: "pending" };
    if (kind) filter.kind = kind;

    const [items, total] = await Promise.all([
      Contribution.find(filter)
        .populate("owner", OWNER_FIELDS)
        .sort({ updatedAt: sort === "oldest" ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Contribution.countDocuments(filter),
    ]);

    const viewer = req.auth;
    sendData(
      res,
      items.map((item) => ({
        ...toContribution(item),
        // Un modérateur ne peut pas valider sa propre contribution : seul un
        // administrateur le peut (§8).
        reviewableByViewer:
          String((item.owner as unknown as { _id: unknown })._id ?? item.owner) !==
            viewer?.userId || viewer?.role === "admin",
      })),
      pageMeta(page, limit, total),
    );
  }),
);

/**
 * Géométrie d'une couche en attente, pour l'aperçu du volet de relecture.
 * Réservée aux modérateurs : la contribution n'est pas encore publique.
 */
moderationRouter.get(
  "/:id/geojson",
  validate(contributionIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);

    const contribution = await Contribution.findById(id).select("layer.geojson kind").lean();
    if (!contribution?.layer) {
      throw ApiError.notFound("Cette contribution ne porte pas de géométrie.");
    }

    sendData(res, contribution.layer.geojson);
  }),
);

moderationRouter.post(
  "/:id/approve",
  validate(contributionIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const actor = req.auth;
    if (!actor) throw ApiError.unauthenticated();

    const contribution = await Contribution.findById(id).populate<{
      owner: { _id: unknown; email: string; displayName: string };
    }>("owner", OWNER_FIELDS);
    if (!contribution) throw ApiError.notFound("Cette contribution n'existe pas.");

    assertOwnReviewAllowed(contribution.owner._id, actor);
    assertTransition(contribution.visibility, "public");

    contribution.visibility = "public";
    contribution.publishedAt = new Date();
    contribution.rejectedReason = null;
    contribution.reviewedBy = actor.userId as never;
    contribution.reviewedAt = new Date();
    await contribution.save();

    await User.updateOne({ _id: contribution.owner._id }, { $inc: { "stats.published": 1 } });
    await record(actor.userId, "approve", "Contribution", contribution._id, null, {
      title: contribution.title,
      kind: contribution.kind,
    });
    await sendApprovalEmail(
      contribution.owner.email,
      contribution.owner.displayName,
      contribution.title,
    );

    sendData(res, toContribution(contribution), {
      message: `« ${contribution.title} » est publiée. Son auteur en est informé.`,
    });
  }),
);

moderationRouter.post(
  "/:id/reject",
  validate(contributionIdParamSchema, "params"),
  validate(rejectContributionSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const { reason } = req.body as ReturnType<typeof rejectContributionSchema.parse>;
    const actor = req.auth;
    if (!actor) throw ApiError.unauthenticated();

    const contribution = await Contribution.findById(id).populate<{
      owner: { _id: unknown; email: string; displayName: string };
    }>("owner", OWNER_FIELDS);
    if (!contribution) throw ApiError.notFound("Cette contribution n'existe pas.");

    assertOwnReviewAllowed(contribution.owner._id, actor);
    assertTransition(contribution.visibility, "rejected");

    contribution.visibility = "rejected";
    contribution.publishedAt = null;
    contribution.rejectedReason = reason;
    contribution.reviewedBy = actor.userId as never;
    contribution.reviewedAt = new Date();
    await contribution.save();

    await record(actor.userId, "reject", "Contribution", contribution._id, reason, {
      title: contribution.title,
      kind: contribution.kind,
    });
    // Le motif parvient au contributeur (§8, §13).
    await sendRejectionEmail(
      contribution.owner.email,
      contribution.owner.displayName,
      contribution.title,
      reason,
    );

    sendData(res, toContribution(contribution), {
      message: "Le motif du refus a été transmis à son auteur.",
    });
  }),
);

moderationRouter.post(
  "/:id/unpublish",
  validate(contributionIdParamSchema, "params"),
  validate(unpublishContributionSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, contributionIdParamSchema);
    const { reason } = req.body as ReturnType<typeof unpublishContributionSchema.parse>;
    const actor = req.auth;
    if (!actor) throw ApiError.unauthenticated();

    const contribution = await Contribution.findById(id).populate<{
      owner: { _id: unknown; email: string; displayName: string };
    }>("owner", OWNER_FIELDS);
    if (!contribution) throw ApiError.notFound("Cette contribution n'existe pas.");
    if (contribution.visibility !== "public") {
      throw ApiError.conflict("Cette contribution n'est pas publiée.");
    }

    assertOwnReviewAllowed(contribution.owner._id, actor);

    contribution.visibility = "rejected";
    contribution.publishedAt = null;
    contribution.rejectedReason = reason;
    contribution.reviewedBy = actor.userId as never;
    contribution.reviewedAt = new Date();
    await contribution.save();

    await User.updateOne({ _id: contribution.owner._id }, { $inc: { "stats.published": -1 } });
    await record(actor.userId, "unpublish", "Contribution", contribution._id, reason, {
      title: contribution.title,
      kind: contribution.kind,
    });
    await sendRejectionEmail(
      contribution.owner.email,
      contribution.owner.displayName,
      contribution.title,
      reason,
    );

    sendData(res, toContribution(contribution), {
      message: "Cette contribution est retirée de l'espace public. Son auteur en est informé.",
    });
  }),
);

/* --- Signalements ---------------------------------------------------- */
moderationRouter.get(
  "/reports",
  validate(listReportsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { status, page, limit } = validatedQuery(req, listReportsQuerySchema);

    const [items, total] = await Promise.all([
      Report.find({ status })
        .populate<{ reporter: { _id: unknown; displayName: string } }>("reporter", "displayName")
        .populate<{ contribution: { _id: unknown; title: string; kind: string } }>(
          "contribution",
          "title kind",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Report.countDocuments({ status }),
    ]);

    sendData(
      res,
      items.map((report) => ({
        id: String(report._id),
        reason: report.reason,
        note: report.note ?? null,
        status: report.status,
        reporter: report.reporter
          ? { id: String(report.reporter._id), displayName: report.reporter.displayName }
          : null,
        contribution: report.contribution
          ? {
              id: String(report.contribution._id),
              title: report.contribution.title,
              kind: report.contribution.kind,
            }
          : null,
        createdAt: new Date(report.createdAt).toISOString(),
      })),
      pageMeta(page, limit, total),
    );
  }),
);

moderationRouter.post(
  "/reports/:id/close",
  validate(idParamSchema, "params"),
  validate(closeReportSchema),
  asyncHandler(async (req, res) => {
    const { id } = validatedParams(req, idParamSchema);
    const { note } = req.body as ReturnType<typeof closeReportSchema.parse>;
    const actor = req.auth;
    if (!actor) throw ApiError.unauthenticated();

    const report = await Report.findById(id);
    if (!report) throw ApiError.notFound("Ce signalement n'existe pas.");
    if (report.status === "closed") {
      throw ApiError.conflict("Ce signalement est déjà clos.");
    }

    report.status = "closed";
    report.closedBy = actor.userId as never;
    report.closedAt = new Date();
    report.closeNote = note ?? null;
    await report.save();

    sendData(res, { closed: true }, { message: "Signalement clos." });
  }),
);

/* --- Journal d'audit -------------------------------------------------- */
moderationRouter.get(
  "/log",
  validate(listModerationLogQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { action, actor, page, limit } = validatedQuery(req, listModerationLogQuerySchema);

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (actor) filter.actor = actor;

    const [entries, total] = await Promise.all([
      ModerationLog.find(filter)
        .populate<{ actor: { _id: unknown; displayName: string; role: string } }>(
          "actor",
          "displayName role",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ModerationLog.countDocuments(filter),
    ]);

    sendData(
      res,
      entries.map((entry) => ({
        id: String(entry._id),
        action: entry.action,
        actor: entry.actor
          ? {
              id: String(entry.actor._id),
              displayName: entry.actor.displayName,
              role: entry.actor.role,
            }
          : null,
        target: { model: entry.target.model, id: String(entry.target.id) },
        reason: entry.reason ?? null,
        snapshot: entry.snapshot ?? null,
        createdAt: new Date(entry.createdAt).toISOString(),
      })),
      pageMeta(page, limit, total),
    );
  }),
);

/**
 * Un modérateur ne peut pas statuer sur sa propre contribution — il faut un
 * administrateur (§8, §13).
 */
function assertOwnReviewAllowed(
  ownerId: unknown,
  actor: { userId: string; role: "user" | "moderator" | "admin" },
): void {
  if (String(ownerId) === actor.userId && !isAtLeast(actor.role, "admin")) {
    throw ApiError.forbidden(
      "Vous ne pouvez pas statuer sur votre propre contribution. Un administrateur doit s'en charger.",
    );
  }
}
