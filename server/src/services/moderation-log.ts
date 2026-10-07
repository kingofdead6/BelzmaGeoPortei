import type { Types } from "mongoose";
import type { ModerationAction } from "@belezma/shared";
import { ModerationLog } from "../models/index.js";
import { logger } from "../utils/logger.js";

/**
 * Consigne une décision dans le journal d'audit, en ajout seul. Une écriture
 * impossible est journalisée sans faire échouer l'action : la décision reste
 * valide, et l'incident reste traçable.
 */
export async function record(
  actorId: string,
  action: ModerationAction,
  targetModel: string,
  targetId: Types.ObjectId | string,
  reason: string | null,
  snapshot: unknown,
): Promise<void> {
  try {
    await ModerationLog.create({
      actor: actorId,
      action,
      target: { model: targetModel, id: targetId },
      reason,
      snapshot,
    });
  } catch (error) {
    logger.error(
      { err: error, action, targetId: String(targetId), actorId },
      "Écriture du journal de modération impossible",
    );
  }
}
