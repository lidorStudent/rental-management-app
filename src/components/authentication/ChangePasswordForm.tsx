"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { changePassword } from "@/actions/authenticationActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validation/authenticationSchemas";

const PASSWORD_HINT =
  "At least 10 characters, with an uppercase letter, a lowercase letter and a digit.";

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
        applyServerFieldErrors(setError, result.fieldErrors);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        error={formState.errors.newPassword?.message}
        {...register("newPassword")}
      />

      <TextField
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        error={formState.errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <SubmitButton isSubmitting={isSubmitting}>Set password</SubmitButton>
    </form>
  );
}
