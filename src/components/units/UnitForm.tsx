"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { createUnit, updateUnit } from "@/actions/unitActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { updateUnitSchema, type UpdateUnitInput } from "@/lib/validation/unitSchemas";

/**
 * One form for adding a unit to a building and for editing one, in the same shape as PropertyForm.
 *
 * Two units in one building cannot share a label. That rule lives in the database, as a unique
 * constraint, so it is the action that catches it and returns it against the label field.
 */
type UnitFormValues = Omit<UpdateUnitInput, "unitId">;

type UnitFormProps =
  | { mode: "create"; propertyId: string }
  | { mode: "edit"; unitId: string; propertyId: string; initialValues: UnitFormValues };

const EMPTY_UNIT: UnitFormValues = { label: "", bedroomCount: undefined };

export function UnitForm(props: UnitFormProps) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<UnitFormValues>({
    resolver: zodResolver(updateUnitSchema.omit({ unitId: true })),
    defaultValues: props.mode === "edit" ? props.initialValues : EMPTY_UNIT,
  });

  function submit(values: UnitFormValues) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result =
        props.mode === "create"
          ? await createUnit({ ...values, propertyId: props.propertyId })
          : await updateUnit({ ...values, unitId: props.unitId });

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      router.push(`/landlord/properties/${props.propertyId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <TextField
        label="Label"
        hint="How you tell this one from the others: Flat 2, Ground floor, Studio."
        error={formState.errors.label?.message}
        {...register("label")}
      />

      <TextField
        label="Bedrooms"
        type="number"
        min={0}
        max={20}
        hint="Optional."
        error={formState.errors.bedroomCount?.message}
        // An empty box means "not recorded", which is not the same as zero bedrooms.
        {...register("bedroomCount", {
          setValueAs: (value: string) => (value === "" ? undefined : Number(value)),
        })}
      />

      <SubmitButton isSubmitting={isSubmitting}>
        {props.mode === "create" ? "Add unit" : "Save changes"}
      </SubmitButton>
    </form>
  );
}
