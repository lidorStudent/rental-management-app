import { ChangePasswordForm } from "@/components/authentication/ChangePasswordForm";
import { LogoMark } from "@/components/shared/LogoMark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSignedInProfile } from "@/lib/authentication/getSignedInProfile";

export default async function ChangePasswordPage() {
  const profile = await getSignedInProfile();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4 sm:p-6">
      <Card>
        <CardHeader>
          {/* The first screen a tenant ever sees, so the mark stands on its own here. */}
          <div className="flex justify-center px-2 pb-2">
            <LogoMark className="h-12" />
          </div>
          <CardTitle>
            <h1 className="page-title">
              {profile.mustChangePassword ? "Set your own password" : "Change your password"}
            </h1>
          </CardTitle>
          <CardDescription>
            {profile.mustChangePassword
              ? "Your landlord created this account with a temporary password. Choose your own before continuing."
              : "Signed in as " + profile.email + "."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
