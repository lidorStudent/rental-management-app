"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { submitMaintenanceRequest } from "@/actions/maintenanceRequestActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { SelectField } from "@/components/forms/SelectField";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  submitMaintenanceRequestSchema,
  type SubmitMaintenanceRequestInput,
} from "@/lib/validation/maintenanceSchemas";

/**
 * Reporting a problem with the home.
 *
 * There is no lease, no unit and no landlord in this form. All three are resolved from the tenant's
 * session on the server, so there is nothing in the payload that could point at somebody else's
 * flat, and nothing for the server to have to verify against the sender.
 */
const URGENCY_OPTIONS = [
  { value: "low", label: "Low - it can wait" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent - it needs attention now" },
];

export function MaintenanceRequestForm() {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<SubmitMaintenanceRequestInput>({
    resolver: zodResolver(submitMaintenanceRequestSchema, undefined, { raw: true }),
    defaultValues: { title: "", description: "", urgency: "normal" },
  });

  function submit(values: SubmitMaintenanceRequestInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result = await submitMaintenanceRequest(values);

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      router.push(`/tenant/maintenance/${result.value.requestId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <TextField
        label="What is wrong"
        hint="A short title your landlord will see in their list."
        error={formState.errors.title?.message}
        {...register("title")}
      />

      <TextAreaField
        label="Describe it"
        rows={5}
        hint="What is happening, where, and since when. Enough for your landlord to act on without asking."
        error={formState.errors.description?.message}
        {...register("description")}
      />

      <SelectField
        label="How urgent is it"
        options={URGENCY_OPTIONS}
        error={formState.errors.urgency?.message}
        {...register("urgency")}
      />

      <SubmitButton isSubmitting={isSubmitting}>Report this problem</SubmitButton>
    </form>
  );
}
