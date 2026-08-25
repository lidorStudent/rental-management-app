"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { signIn } from "@/actions/authenticationActions";
import { FieldError } from "@/components/shared/FieldError";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInSchema, type SignInInput } from "@/lib/validation/authenticationSchemas";

export function SignInForm() {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  function submit(values: SignInInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      // A successful sign-in redirects inside the action, so there is no success branch here.
      const result = await signIn(values);
      if (result.status === "error") {
        setFormMessage(result.message);
        for (const [fieldName, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(fieldName as keyof SignInInput, { message });
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

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
          autoComplete="current-password"
          {...register("password")}
        />
        <FieldError message={formState.errors.password?.message} />
      </div>

      <SubmitButton isSubmitting={isSubmitting}>Sign in</SubmitButton>
    </form>
  );
}
