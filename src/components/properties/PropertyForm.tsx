"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { createProperty, updateProperty } from "@/actions/propertyActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { createPropertySchema, type CreatePropertyInput } from "@/lib/validation/propertySchemas";

/**
 * One form for adding a building and for editing one. The fields and their rules are the same in
 * both cases, so the only difference is which action the submit calls and where it goes afterwards.
 *
 * The action returns a result rather than redirecting, so navigation happens here, where the reader
 * is. Anything the server refuses comes back as a message, and anything it can attribute to a field
 * is put back on that field.
 */
type PropertyFormProps =
  { mode: "create" } | { mode: "edit"; propertyId: string; initialValues: CreatePropertyInput };

const EMPTY_PROPERTY: CreatePropertyInput = {
  name: "",
  addressLine: "",
  city: "",
  postalCode: "",
};

export function PropertyForm(props: PropertyFormProps) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<CreatePropertyInput>({
    resolver: zodResolver(createPropertySchema, undefined, { raw: true }),
    defaultValues: props.mode === "edit" ? props.initialValues : EMPTY_PROPERTY,
  });

  function submit(values: CreatePropertyInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result =
        props.mode === "create"
          ? await createProperty(values)
          : await updateProperty({ ...values, propertyId: props.propertyId });

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      router.push(`/landlord/properties/${result.value.propertyId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <TextField
        label="Name"
        hint="What you call the building. It is only ever shown to you."
        error={formState.errors.name?.message}
        {...register("name")}
      />

      <TextField
        label="Street and number"
        autoComplete="street-address"
        error={formState.errors.addressLine?.message}
        {...register("addressLine")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="City" error={formState.errors.city?.message} {...register("city")} />
        <TextField
          label="Postal code"
          hint="Optional."
          error={formState.errors.postalCode?.message}
          {...register("postalCode")}
        />
      </div>

      <SubmitButton isSubmitting={isSubmitting}>
        {props.mode === "create" ? "Add property" : "Save changes"}
      </SubmitButton>
    </form>
  );
}
