"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { correctRentPayment, recordRentPayment } from "@/actions/rentPaymentActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import {
  buildRecordRentPaymentSchema,
  type RecordRentPaymentInput,
} from "@/lib/validation/rentPaymentSchemas";

/**
 * Recording money that has arrived, and correcting an entry that went in wrongly.
 *
 * Both are the same six fields, so they are the same form. What differs is which action it calls and
 * that a correction cannot move a payment onto another tenancy: the lease is not a field.
 *
 * There is no status anywhere on this form. A landlord records what arrived and when; whether that
 * leaves a period paid, part paid or overdue follows from the ledger and the date.
 */
const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export type PeriodChoice = { periodMonth: string; label: string };

type RentPaymentFormProps = {
  leaseId: string;
  periods: readonly PeriodChoice[];
  today: string;
  defaultPeriodMonth: string;
} & (
  { mode: "record" } | { mode: "correct"; paymentId: string; initialValues: RecordRentPaymentInput }
);

export function RentPaymentForm(props: RentPaymentFormProps) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();

  // The schema needs to know what today is, because a payment cannot have arrived in the future.
  // The server builds it again with its own date, and that run is the one that counts.
  const schema = buildRecordRentPaymentSchema(props.today);
  const { register, handleSubmit, setError, formState } = useForm<RecordRentPaymentInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues:
      props.mode === "correct"
        ? props.initialValues
        : {
            leaseId: props.leaseId,
            periodMonth: props.defaultPeriodMonth,
            amount: "",
            receivedOn: props.today,
            method: "bank_transfer",
            reference: "",
          },
  });

  function submit(values: RecordRentPaymentInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result =
        props.mode === "record"
          ? await recordRentPayment(values)
          : await correctRentPayment({
              periodMonth: values.periodMonth,
              amount: values.amount,
              receivedOn: values.receivedOn,
              method: values.method,
              reference: values.reference,
              paymentId: props.paymentId,
            });

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      router.push(`/landlord/leases/${props.leaseId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrorSummary message={formMessage} />
      <input type="hidden" {...register("leaseId")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="For the month of"
          hint="The rent period this money settles."
          options={props.periods.map((period) => ({
            value: period.periodMonth,
            label: period.label,
          }))}
          error={formState.errors.periodMonth?.message}
          {...register("periodMonth")}
        />
        <TextField
          label="Amount received"
          inputMode="decimal"
          hint="Part of a month's rent is fine. What is left shows as outstanding."
          error={formState.errors.amount?.message}
          {...register("amount")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Received on"
          type="date"
          max={props.today}
          error={formState.errors.receivedOn?.message}
          {...register("receivedOn")}
        />
        <SelectField
          label="How it arrived"
          options={PAYMENT_METHODS}
          error={formState.errors.method?.message}
          {...register("method")}
        />
      </div>

      <TextField
        label="Reference"
        hint="Optional. A bank reference or cheque number, for when a payment is queried later."
        error={formState.errors.reference?.message}
        {...register("reference")}
      />

      <SubmitButton isSubmitting={isSubmitting}>
        {props.mode === "record" ? "Record this payment" : "Save the correction"}
      </SubmitButton>
    </form>
  );
}
