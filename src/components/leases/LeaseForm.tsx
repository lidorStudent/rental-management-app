"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { createLease } from "@/actions/leaseActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { createLeaseSchema, type CreateLeaseInput } from "@/lib/validation/leaseSchemas";

/**
 * Recording a tenancy. The unit's current occupancy is shown as soon as one is chosen, because the
 * commonest mistake here is letting a flat that is already let, and the second commonest is not
 * knowing when the current tenancy ends.
 *
 * The occupancy of every unit arrives as a prop, read on the server. Choosing a unit fetches
 * nothing.
 */
export type UnitChoice = {
  unitId: string;
  label: string;
  propertyName: string;
  occupancy: string;
};

export function LeaseForm({
  units,
  preselectedUnitId,
}: {
  units: readonly UnitChoice[];
  preselectedUnitId?: string;
}) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState, control } = useForm<CreateLeaseInput>({
    // raw: true hands the submit handler what the person typed, not what the schema turned it
    // into. The action parses the same schema again on the server, and that run is the one that
    // matters; sending it a number where it expects "6,500.50" would fail there.
    resolver: zodResolver(createLeaseSchema, undefined, { raw: true }),
    defaultValues: initialValues(units, preselectedUnitId),
  });

  // useWatch rather than watch(): the React compiler cannot memoize watch() safely, and this
  // component re-renders on every keystroke without it.
  const chosenUnitId = useWatch({ control, name: "unitId" });
  const chosenUnit = units.find((unit) => unit.unitId === chosenUnitId);

  function submit(values: CreateLeaseInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result = await createLease(values);

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      router.push(`/landlord/leases/${result.value.leaseId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />

      <div className="space-y-1.5">
        <SelectField
          label="Unit"
          error={formState.errors.unitId?.message}
          options={units.map((unit) => ({
            value: unit.unitId,
            label: `${unit.label} - ${unit.propertyName}`,
          }))}
          {...register("unitId")}
        />
        {chosenUnit === undefined ? null : (
          <p className="text-muted-foreground text-sm" data-testid="unit-occupancy">
            Currently: {chosenUnit.occupancy}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Starts on"
          type="date"
          error={formState.errors.startDate?.message}
          {...register("startDate")}
        />
        <TextField
          label="Ends on"
          type="date"
          hint="The last day of the tenancy. That day belongs to this tenant."
          error={formState.errors.endDate?.message}
          {...register("endDate")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Monthly rent"
          inputMode="decimal"
          placeholder="6500"
          error={formState.errors.rentAmount?.message}
          {...register("rentAmount")}
        />
        <TextField
          label="Deposit"
          inputMode="decimal"
          hint="Leave empty if none."
          error={formState.errors.depositAmount?.message}
          {...register("depositAmount")}
        />
        <TextField
          label="Rent due on day"
          type="number"
          min={1}
          max={28}
          hint="1 to 28, so every month has one."
          error={formState.errors.rentDueDay?.message}
          {...register("rentDueDay", { setValueAs: (value: string) => Number(value) })}
        />
      </div>

      <SubmitButton isSubmitting={isSubmitting}>Record tenancy</SubmitButton>
    </form>
  );
}

/** The unit a landlord arrived with, or the first one they have, so the form is never blank. */
function initialValues(
  units: readonly UnitChoice[],
  preselectedUnitId: string | undefined,
): CreateLeaseInput {
  const firstUnit = units[0];
  const chosen = preselectedUnitId ?? firstUnit?.unitId ?? "";

  return {
    unitId: chosen,
    startDate: "",
    endDate: "",
    rentAmount: "",
    depositAmount: "",
    rentDueDay: 1,
  };
}
