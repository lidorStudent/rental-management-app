"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { changePassword } from "@/actions/authenticationActions";
import { FieldError } from "@/components/shared/FieldError";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validation/authenticationSchemas";

export function ChangePasswordForm() {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  function submit(values: ChangePasswordInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result = await changePassword(values);
      if (result.status === "error") {
        setFormMessage(result.message);
        for (const [fieldName, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(fieldName as keyof ChangePasswordInput, { message });
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register("newPassword")}
        />
        <p className="text-sm text-muted-foreground">
          At least 10 characters, with an uppercase letter, a lowercase letter and a digit.
        </p>
        <FieldError message={formState.errors.newPassword?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Repeat new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        <FieldError message={formState.errors.confirmPassword?.message} />
      </div>

      <SubmitButton isSubmitting={isSubmitting}>Set password</SubmitButton>
    </form>
  );
}
