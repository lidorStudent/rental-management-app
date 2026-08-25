import { z } from "zod";

import { emailField, personNameField, uuidField } from "@/lib/validation/fieldSchemas";

/**
 * One schema per input, imported by both the form and the server action. The form runs it for fast
 * feedback and the action runs it as the trust boundary, and because there is only one definition
 * the two can never drift apart.
 *
 * The password rules mirror the policy the Supabase project itself enforces, so a password this
 * schema accepts is never refused later by the Auth service with a less helpful message.
 */
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one digit.");

export const registerLandlordSchema = z
  .object({
    fullName: personNameField,
    email: emailField,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

export const changePasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export const createTenantAccountSchema = z.object({
  leaseId: uuidField,
  tenantFullName: personNameField,
  tenantEmail: emailField,
});

export const regenerateTenantPasswordSchema = z.object({
  leaseId: uuidField,
});

export type RegisterLandlordInput = z.input<typeof registerLandlordSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type CreateTenantAccountInput = z.input<typeof createTenantAccountSchema>;
export type RegenerateTenantPasswordInput = z.input<typeof regenerateTenantPasswordSchema>;
