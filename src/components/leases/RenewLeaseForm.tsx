"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { renewLease } from "@/actions/leaseActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { renewLeaseSchema, type RenewLeaseInput } from "@/lib/validation/leaseSchemas";

/**
 * Renewing writes the next tenancy rather than extending this one, so the history reads as what
 * happened: one agreement ended and another began, each with its own rent.
 *
 * The unit and the tenant are taken from the tenancy being renewed, on the server. They are not in
 * this form because they are not the landlord's to retype here.
 */
export function RenewLeaseForm({
  leaseId,
  earliestStartDate,
  currentRentAmount,
  currentRentDueDay,
}: {
  leaseId: string;
  earliestStartDate: string;
  currentRentAmount: string;
  currentRentDueDay: number;
}) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<RenewLeaseInput>({
    resolver: zodResolver(renewLeaseSchema, undefined, { raw: true }),
    defaultValues: {
      leaseId,
      startDate: earliestStartDate,
      endDate: "",
      rentAmount: currentRentAmount,
      depositAmount: "",
      rentDueDay: currentRentDueDay,
    },
  });

  function submit(values: RenewLeaseInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result = await renewLease(values);

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
      <input type="hidden" {...register("leaseId")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Starts on"
          type="date"
          hint={`The current tenancy owns its last day, so the renewal can start on ${earliestStartDate} at the earliest.`}
          error={formState.errors.startDate?.message}
          {...register("startDate")}
        />
        <TextField
          label="Ends on"
          type="date"
          error={formState.errors.endDate?.message}
          {...register("endDate")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Monthly rent"
          inputMode="decimal"
          hint="The new rent, which may be the same."
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
          error={formState.errors.rentDueDay?.message}
          {...register("rentDueDay", { setValueAs: (value: string) => Number(value) })}
        />
      </div>

      <SubmitButton isSubmitting={isSubmitting}>Record the renewal</SubmitButton>
    </form>
  );
}
