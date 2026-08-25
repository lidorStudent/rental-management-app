import { z } from "zod";

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

const emailSchema = z
  .string()
  .min(1, "Enter an email address.")
  .email("Enter a valid email address.")
  .max(320, "That email address is too long.");

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter a full name.")
  .max(120, "Use at most 120 characters.");

export const registerLandlordSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: emailSchema,
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
  leaseId: z.string().uuid("That is not a valid lease."),
  tenantFullName: fullNameSchema,
  tenantEmail: emailSchema,
});

export const regenerateTenantPasswordSchema = z.object({
  leaseId: z.string().uuid("That is not a valid lease."),
});

export type RegisterLandlordInput = z.infer<typeof registerLandlordSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateTenantAccountInput = z.infer<typeof createTenantAccountSchema>;
export type RegenerateTenantPasswordInput = z.infer<typeof regenerateTenantPasswordSchema>;
