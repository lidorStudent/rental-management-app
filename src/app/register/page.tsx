import Link from "next/link";

import { RegisterLandlordForm } from "@/components/authentication/RegisterLandlordForm";
import { LogoMark } from "@/components/shared/LogoMark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4 sm:p-6">
      <Card>
        <CardHeader>
          {/* The mark bleeds to both side edges, so the row below gives it its own room. */}
          <div className="flex justify-center px-2 pb-2">
            <LogoMark className="h-12" />
          </div>
          <CardTitle>
            <h1 className="page-title">Create a landlord account</h1>
          </CardTitle>
          <CardDescription>
            Only landlords register here. A tenant is given an account by their landlord, from the
            lease.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RegisterLandlordForm />

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
