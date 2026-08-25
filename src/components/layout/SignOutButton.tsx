"use client";

import { useTransition } from "react";

import { signOut } from "@/actions/authenticationActions";
import { Button } from "@/components/ui/button";

/** Signing out is a write: it clears the session cookie, so it goes through a server action. */
export function SignOutButton() {
  const [isSigningOut, startSigningOut] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isSigningOut}
      onClick={() => startSigningOut(async () => signOut())}
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </Button>
  );
}
