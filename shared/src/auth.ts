import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "./constants.js";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse e-mail invalide.")
  .max(254);

/** §6 : au moins 10 caractères, sans exigence de composition. */
const passwordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
  .max(200, "Le mot de passe ne peut pas dépasser 200 caractères.");

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Le nom affiché doit contenir au moins 2 caractères.")
  .max(60, "Le nom affiché ne peut pas dépasser 60 caractères.");

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
    organization: z.string().trim().max(120).optional(),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1, "Saisissez votre mot de passe.") })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ token: z.string().min(10), password: passwordSchema })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    organization: z.string().trim().max(120).nullable().optional(),
    bio: z.string().trim().max(600).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification transmise.",
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  organization: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.enum(USER_ROLES),
  stats: z.object({ contributions: z.number(), published: z.number() }),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const sessionUserSchema = publicUserSchema.extend({
  email: z.string(),
  emailVerified: z.boolean(),
  status: z.enum(USER_STATUSES),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export interface AuthResponse {
  user: SessionUser;
  accessToken: string;
  expiresIn: number;
}
