import { z } from "zod";
import { CONTRIBUTION_KINDS, MODERATION_ACTIONS, REPORT_REASONS, USER_ROLES, USER_STATUSES } from "./constants.js";
import { objectIdSchema, paginationQuerySchema } from "./api.js";

export const moderationQueueQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(CONTRIBUTION_KINDS).optional(),
  sort: z.enum(["oldest", "recent"]).default("oldest"),
});

export const rejectContributionSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, "Expliquez le refus en au moins 10 caractères — le motif est transmis au contributeur.")
      .max(600),
  })
  .strict();
export type RejectContributionInput = z.infer<typeof rejectContributionSchema>;

export const unpublishContributionSchema = z
  .object({ reason: z.string().trim().min(10).max(600) })
  .strict();

export const listReportsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["open", "closed"]).default("open"),
});

export const closeReportSchema = z
  .object({ note: z.string().trim().max(600).optional() })
  .strict();

export const listModerationLogQuerySchema = paginationQuerySchema.extend({
  action: z.enum(MODERATION_ACTIONS).optional(),
  actor: objectIdSchema.optional(),
});

export const moderationLogEntrySchema = z.object({
  id: z.string(),
  action: z.enum(MODERATION_ACTIONS),
  actor: z.object({ id: z.string(), displayName: z.string(), role: z.enum(USER_ROLES) }).nullable(),
  target: z.object({ model: z.string(), id: z.string() }),
  reason: z.string().nullable(),
  snapshot: z.unknown(),
  createdAt: z.string(),
});
export type ModerationLogEntry = z.infer<typeof moderationLogEntrySchema>;

export const reportSchema = z.object({
  id: z.string(),
  reason: z.enum(REPORT_REASONS),
  note: z.string().nullable(),
  status: z.enum(["open", "closed"]),
  reporter: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  contribution: z.object({ id: z.string(), title: z.string(), kind: z.enum(CONTRIBUTION_KINDS) }).nullable(),
  createdAt: z.string(),
});
export type Report = z.infer<typeof reportSchema>;

/* --- Administration ------------------------------------------------- */

export const listUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(2).max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const changeRoleSchema = z.object({ role: z.enum(USER_ROLES) }).strict();
export const changeStatusSchema = z
  .object({
    status: z.enum(USER_STATUSES),
    reason: z.string().trim().min(10).max(600).optional(),
  })
  .strict();

export const adminStatsSchema = z.object({
  users: z.object({ total: z.number(), active: z.number(), suspended: z.number(), byRole: z.record(z.number()) }),
  contributions: z.object({ total: z.number(), byVisibility: z.record(z.number()), byKind: z.record(z.number()) }),
  queue: z.object({ pending: z.number(), openReports: z.number(), oldestPendingAt: z.string().nullable() }),
  uploadsPerWeek: z.array(z.object({ week: z.string(), count: z.number() })),
  storage: z.object({ mediaBytes: z.number(), sourceFileBytes: z.number(), geometryBytes: z.number() }),
  layers: z.object({ official: z.number(), contributed: z.number() }),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;
