"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { registerLandlordAccount } from "@/actions/authenticationActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  registerLandlordSchema,
  type RegisterLandlordInput,
} from "@/lib/validation/authenticationSchemas";

const PASSWORD_HINT =
  "At least 10 characters, with an uppercase letter, a lowercase letter and a digit.";

export function RegisterLandlordForm() {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<RegisterLandlordInput>({
    resolver: zodResolver(registerLandlordSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  function submit(values: RegisterLandlordInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result = await registerLandlordAccount(values);
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
        label="Full name"
        autoComplete="name"
        error={formState.errors.fullName?.message}
        {...register("fullName")}
      />

      <TextField
        label="Email address"
        type="email"
        autoComplete="email"
        error={formState.errors.email?.message}
        {...register("email")}
      />

      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        error={formState.errors.password?.message}
        {...register("password")}
      />

      <TextField
        label="Repeat password"
        type="password"
        autoComplete="new-password"
        error={formState.errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <SubmitButton isSubmitting={isSubmitting}>Create account</SubmitButton>
    </form>
  );
}
