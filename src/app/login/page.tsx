import Link from "next/link";

import { SignInForm } from "@/components/authentication/SignInForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { problem } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="page-title">Sign in</h1>
          </CardTitle>
          <CardDescription>Rental management for landlords and their tenants.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {problem === "profile-missing" ? (
            <p role="alert" className="rounded-md border px-3 py-2 text-sm">
              That account is not set up correctly, so it has been signed out. A landlord can create
              the tenant account again from the lease.
            </p>
          ) : null}

          <SignInForm />

          <p className="text-sm text-muted-foreground">
            Landlords can{" "}
            <Link href="/register" className="underline">
              create an account
            </Link>
            . Tenants are given an account by their landlord.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
