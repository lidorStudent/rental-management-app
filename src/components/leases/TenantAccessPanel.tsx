"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  createTenantAccountForLease,
  regenerateTenantPassword,
} from "@/actions/tenantAccountActions";
import { applyServerFieldErrors } from "@/components/forms/applyServerFieldErrors";
import { TextField } from "@/components/forms/TextField";
import { FormErrorSummary } from "@/components/shared/FormErrorSummary";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  createTenantAccountSchema,
  type CreateTenantAccountInput,
} from "@/lib/validation/authenticationSchemas";

/**
 * Giving the tenant a way in.
 *
 * There is no email service in this product, by design, so the landlord creates the account and is
 * handed a temporary password to pass on however they already talk to that tenant. The password is
 * shown once and stored nowhere: after this panel is closed, the only copy that exists is the hash
 * inside Supabase Auth.
 */
type TenantAccessPanelProps = {
  leaseId: string;
  tenant: { fullName: string; email: string; mustChangePassword: boolean } | null;
};

export function TenantAccessPanel({ leaseId, tenant }: TenantAccessPanelProps) {
  const [issuedPassword, setIssuedPassword] = useState<{ password: string; email: string } | null>(
    null,
  );

  if (issuedPassword !== null) {
    return (
      <TemporaryPasswordNotice
        email={issuedPassword.email}
        password={issuedPassword.password}
        onDismiss={() => setIssuedPassword(null)}
      />
    );
  }

  if (tenant === null) {
    return <CreateTenantAccountForm leaseId={leaseId} onIssued={setIssuedPassword} />;
  }

  return <ExistingTenantAccount leaseId={leaseId} tenant={tenant} onIssued={setIssuedPassword} />;
}

function CreateTenantAccountForm({
  leaseId,
  onIssued,
}: {
  leaseId: string;
  onIssued: (issued: { password: string; email: string }) => void;
}) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<CreateTenantAccountInput>({
    resolver: zodResolver(createTenantAccountSchema, undefined, { raw: true }),
    defaultValues: { leaseId, tenantFullName: "", tenantEmail: "" },
  });

  function submit(values: CreateTenantAccountInput) {
    setFormMessage(null);
    startSubmitting(async () => {
      const result = await createTenantAccountForLease(values);

      if (result.status === "error") {
        setFormMessage(result.message);
        applyServerFieldErrors(setError, result.fieldErrors);
        return;
      }

      onIssued({ password: result.value.temporaryPassword, email: result.value.tenantEmail });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <p className="text-muted-foreground text-sm">
        No tenant account yet. Creating one gives this tenant a temporary password for their own
        portal, where they can see their rent and report problems.
      </p>

      <FormErrorSummary message={formMessage} />
      <input type="hidden" {...register("leaseId")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tenant name"
          error={formState.errors.tenantFullName?.message}
          {...register("tenantFullName")}
        />
        <TextField
          label="Tenant email"
          type="email"
          hint="They sign in with this."
          error={formState.errors.tenantEmail?.message}
          {...register("tenantEmail")}
        />
      </div>

      <SubmitButton isSubmitting={isSubmitting} variant="outline">
        Create the tenant account
      </SubmitButton>
    </form>
  );
}

function ExistingTenantAccount({
  leaseId,
  tenant,
  onIssued,
}: {
  leaseId: string;
  tenant: { fullName: string; email: string; mustChangePassword: boolean };
  onIssued: (issued: { password: string; email: string }) => void;
}) {
  const router = useRouter();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [isResetting, startResetting] = useTransition();

  return (
    <div className="space-y-3">
      <FormErrorSummary message={failureMessage} />
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Tenant</dt>
          <dd className="font-medium">{tenant.fullName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Signs in with</dt>
          <dd className="font-medium">{tenant.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Password</dt>
          <dd className="font-medium">
            {tenant.mustChangePassword ? "Temporary, not yet changed" : "Chosen by the tenant"}
          </dd>
        </div>
      </dl>

      <p className="text-muted-foreground text-sm">
        There is no reset by email in this product, so a tenant who has forgotten their password
        needs a new temporary one from you.
      </p>

      <Button
        type="button"
        variant="outline"
        disabled={isResetting}
        onClick={() =>
          startResetting(async () => {
            setFailureMessage(null);
            const result = await regenerateTenantPassword({ leaseId });
            if (result.status === "error") {
              setFailureMessage(result.message);
              return;
            }
            onIssued({ password: result.value.temporaryPassword, email: result.value.tenantEmail });
            router.refresh();
          })
        }
      >
        {isResetting ? "Working..." : "Issue a new temporary password"}
      </Button>
    </div>
  );
}

/**
 * The one moment the password exists outside the database. The wording says so plainly, because a
 * landlord who closes this panel without copying it has to issue another one.
 */
function TemporaryPasswordNotice({
  email,
  password,
  onDismiss,
}: {
  email: string;
  password: string;
  onDismiss: () => void;
}) {
  const [hasCopied, setHasCopied] = useState(false);

  return (
    <div className="border-status-settled-line bg-card space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Give this password to your tenant now</p>
      <p className="text-muted-foreground text-sm">
        It is shown once and cannot be shown again. Nothing stores it, not even this application, so
        if it is lost you will have to issue a new one. Send it to {email} however you normally talk
        to them. They must choose their own password the first time they sign in.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <code
          data-testid="temporary-password"
          className="bg-muted rounded px-3 py-2 font-mono text-base tracking-wider select-all"
        >
          {password}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setHasCopied(true);
            } catch {
              // Some browsers refuse the clipboard without a permission. The password is selectable,
              // so there is still a way to take it.
              setHasCopied(false);
            }
          }}
        >
          {hasCopied ? "Copied" : "Copy"}
        </Button>
      </div>

      <Button type="button" size="sm" onClick={onDismiss}>
        I have given it to them
      </Button>
    </div>
  );
}
