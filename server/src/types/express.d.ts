import type { UserRole } from "@belezma/shared";

declare global {
  namespace Express {
    interface Request {
      /** Renseigné par `requireAuth` / `optionalAuth`. */
      auth?: { userId: string; role: UserRole };
      validatedQuery?: unknown;
      validatedParams?: unknown;
      id?: string;
    }
  }
}

export {};
