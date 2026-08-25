import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { REPORT_REASONS, type ReportReason } from "@belezma/shared";

export interface ReportAttributes {
  contribution: Types.ObjectId;
  reporter: Types.ObjectId;
  reason: ReportReason;
  note?: string | null;
  status: "open" | "closed";
  closedBy?: Types.ObjectId | null;
  closedAt?: Date | null;
  closeNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportDocument = HydratedDocument<ReportAttributes>;

const reportSchema = new Schema<ReportAttributes>(
  {
    contribution: { type: Schema.Types.ObjectId, ref: "Contribution", required: true, index: true },
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    note: { type: String, default: null, trim: true },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
    closeNote: { type: String, default: null },
  },
  { timestamps: true },
);

// Un utilisateur ne signale une contribution qu'une fois.
reportSchema.index({ contribution: 1, reporter: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report: Model<ReportAttributes> = model<ReportAttributes>("Report", reportSchema);
