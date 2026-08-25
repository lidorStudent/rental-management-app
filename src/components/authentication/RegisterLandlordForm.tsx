"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { registerLandlordAccount } from "@/actions/authenticationActions";
import { FieldError } from "@/components/shared/FieldError";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  registerLandlordSchema,
  type RegisterLandlordInput,
} from "@/lib/validation/authenticationSchemas";

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
        for (const [fieldName, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(fieldName as keyof RegisterLandlordInput, { message });
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
        <FieldError message={formState.errors.fullName?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FieldError message={formState.errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <p className="text-sm text-muted-foreground">
          At least 10 characters, with an uppercase letter, a lowercase letter and a digit.
        </p>
        <FieldError message={formState.errors.password?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Repeat password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        <FieldError message={formState.errors.confirmPassword?.message} />
      </div>

      <SubmitButton isSubmitting={isSubmitting}>Create account</SubmitButton>
    </form>
  );
}
