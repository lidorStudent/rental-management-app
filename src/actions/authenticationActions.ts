"use server";

import { redirect } from "next/navigation";

import { errorResult, validationErrorResult, type ActionResult } from "@/lib/actionResult";
import { ProfileMissingError } from "@/lib/authentication/authenticationErrors";
import { getSignedInProfile } from "@/lib/authentication/getSignedInProfile";
import { homePathForRole } from "@/lib/authentication/homePathForRole";
import {
  changePasswordSchema,
  registerLandlordSchema,
  signInSchema,
  type ChangePasswordInput,
  type RegisterLandlordInput,
  type SignInInput,
} from "@/lib/validation/authenticationSchemas";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * Deliberately vague, and used for every failure that could otherwise confirm whether an address is
 * already registered. Telling a stranger which of their guesses exist is how account lists are
 * built.
 */
const SIGN_UP_REFUSED_MESSAGE =
  "That email address cannot be used to register. If you already have an account, sign in instead.";

const SIGN_IN_REFUSED_MESSAGE = "That email address and password do not match an account.";

export async function registerLandlordAccount(input: RegisterLandlordInput): Promise<ActionResult> {
  const parsed = registerLandlordSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();
  const { error } = await supabaseClient.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // The database trigger reads these two values to build the profile row, which is what gives
    // the account its role. A landlord is the only role that can be created this way.
    options: { data: { role: "landlord", full_name: parsed.data.fullName } },
  });

  if (error !== null) {
    if (error.code === "weak_password") {
      return errorResult("That password is not strong enough.", { password: error.message });
    }
    console.error("registerLandlordAccount failed", { code: error.code });
    return errorResult(SIGN_UP_REFUSED_MESSAGE);
  }

  redirect("/landlord");
}

export async function signIn(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error !== null) {
    // One message for a wrong password and for an address that has no account, so that the form
    // cannot be used to find out which addresses are registered.
    return errorResult(SIGN_IN_REFUSED_MESSAGE);
  }

  let destination: string;
  try {
    const profile = await getSignedInProfile();
    destination = profile.mustChangePassword ? "/change-password" : homePathForRole(profile.role);
  } catch (failure) {
    if (failure instanceof ProfileMissingError) {
      await supabaseClient.auth.signOut();
      return errorResult(
        "This account is not set up correctly and cannot be used. Ask your landlord to create it again.",
      );
    }
    throw failure;
  }

  redirect(destination);
}

export async function signOut(): Promise<void> {
  const supabaseClient = await createSupabaseServerClient();
  await supabaseClient.auth.signOut();
  redirect("/login");
}

export async function changePassword(input: ChangePasswordInput): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const profile = await getSignedInProfile();
  const supabaseClient = await createSupabaseServerClient();

  const { error } = await supabaseClient.auth.updateUser({ password: parsed.data.newPassword });
  if (error !== null) {
    if (error.code === "same_password") {
      return errorResult("Choose a password you have not used here before.", {
        newPassword: "This is already your password.",
      });
    }
    if (error.code === "weak_password") {
      return errorResult("That password is not strong enough.", { newPassword: error.message });
    }
    console.error("changePassword failed", { code: error.code });
    return errorResult("The password could not be changed. Try again.");
  }

  // Clearing the flag is what releases the tenant from the forced-change redirect in middleware.
  const { error: profileError } = await supabaseClient
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", profile.id);

  if (profileError !== null) {
    console.error("changePassword could not clear must_change_password", {
      code: profileError.code,
    });
    return errorResult("The password was changed, but the account is still marked for a reset.");
  }

  redirect(homePathForRole(profile.role));
}
