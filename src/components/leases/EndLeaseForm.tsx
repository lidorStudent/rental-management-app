"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { endLease } from "@/actions/leaseActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { endLeaseSchema, type EndLeaseInput } from "@/lib/validation/leaseSchemas";

/**
 * Ending a tenancy early. Only the end date moves: the rent that was agreed and the day it falls
 * due are matters of record.
 *
 * The action compares the new dates against the other tenancies on the unit and excludes this lease
 * from that comparison, so shortening a lease never collides with the version of itself already
 * stored.
 */
export function EndLeaseForm({
  leaseId,
  currentEndDate,
}: {
  leaseId: string;
  currentEndDate: string;
}) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<EndLeaseInput>({
    resolver: zodResolver(endLeaseSchema, undefined, { raw: true }),
    defaultValues: { leaseId, endDate: "" },
  });

  function submit(values: EndLeaseInput) {
    setFormMessage(null);
    setWarning(null);
    startSubmitting(async () => {
      const result = await endLease(values);

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      if (result.value.recordedPaymentsAfterNewEndDate > 0) {
        setWarning(
          `${result.value.recordedPaymentsAfterNewEndDate} recorded payment${result.value.recordedPaymentsAfterNewEndDate === 1 ? " falls" : "s fall"} after the new end date. They stay in the ledger, but the schedule no longer has a period for them.`,
        );
        return;
      }

      router.push(`/landlord/leases/${leaseId}`);
    });
  }

  if (warning !== null) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border px-3 py-2 text-sm" role="status">
          The tenancy was ended. {warning}
        </p>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => router.push(`/landlord/leases/${leaseId}`)}
        >
          Back to the tenancy
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />
      <input type="hidden" {...register("leaseId")} />

      <TextField
        label="New end date"
        type="date"
        hint={`This tenancy currently runs to ${currentEndDate}. Ending it brings that date forward; the tenant keeps the day you choose.`}
        error={formState.errors.endDate?.message}
        {...register("endDate")}
      />

      <SubmitButton isSubmitting={isSubmitting}>End the tenancy</SubmitButton>
    </form>
  );
}
