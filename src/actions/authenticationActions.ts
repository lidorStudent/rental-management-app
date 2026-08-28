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
import { createSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { createSupabasePasswordCheckClient } from "@/lib/supabase/passwordCheckClient";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * Deliberately vague, and used for every failure that could otherwise confirm whether an address is
 * already registered. Telling a stranger which of their guesses exist is how account lists are
 * built.
 */
const SIGN_UP_REFUSED_MESSAGE =
  "That email address cannot be used to register. If you already have an account, sign in instead.";

const SIGN_IN_REFUSED_MESSAGE = "That email address and password do not match an account.";

/**
 * Said against the field itself, so nobody has to guess which of the three is at fault. It names the
 * password and nothing else: not whether the account exists, not what Supabase said.
 */
const CURRENT_PASSWORD_REFUSED_MESSAGE = "That is not your current password.";

const TOO_MANY_ATTEMPTS_MESSAGE =
  "Too many attempts in a short time. Wait a few minutes and try again; your password has not been changed.";

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

  // Prove the caller knows the password they are replacing, before replacing it.
  //
  // Without this, a session was enough on its own: anybody holding one could set a new password and
  // lock the real owner out without ever knowing the old one. Supabase's own "secure password
  // change" does not close that, because it exempts any session created in the last 24 hours, which
  // is exactly the window a stolen session is used in, and when it does apply it wants a nonce sent
  // by email or SMS, and this project has neither channel.
  //
  // The check is a sign-in attempt on a client that holds no session and writes no cookie, so the
  // caller's own session is untouched by it. The address is the one on the profile, which is written
  // from auth.users when the account is created, cannot be changed by its owner since
  // profiles_self_service_columns_are_pinned, and cannot be changed anywhere else either, because
  // nothing in this application updates an auth email and the project has no mail service to confirm
  // one with.
  const verification = await createSupabasePasswordCheckClient().auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.currentPassword,
  });

  if (verification.error !== null) {
    // Being throttled is not the same as being wrong, and telling somebody their password is wrong
    // when the truth is "too many attempts, wait" would send them off to reset a password that was
    // correct all along.
    // Measured: a wrong password is 400 with code invalid_credentials, and being throttled is 429
    // with code over_request_rate_limit. Both are checked, so a future release that stops setting
    // one of them still lands on the right message.
    if (
      verification.error.status === 429 ||
      verification.error.code === "over_request_rate_limit"
    ) {
      return errorResult(TOO_MANY_ATTEMPTS_MESSAGE);
    }
    console.error("changePassword could not verify the current password", {
      code: verification.error.code,
    });
    return errorResult(CURRENT_PASSWORD_REFUSED_MESSAGE, {
      currentPassword: CURRENT_PASSWORD_REFUSED_MESSAGE,
    });
  }

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

  // Clearing the flag is what releases the tenant from the forced-change redirect in the proxy.
  //
  // It goes through the admin client because profiles_self_service_columns_are_pinned refuses this
  // column to the account that owns it: a tenant who could clear it themselves could skip the
  // change entirely and keep the landlord's temporary password. The id is the one getSignedInProfile
  // resolved from the verified session a few lines above, never a value from the form, so the
  // service role is being pointed at the caller's own row and nothing else.
  const { error: profileError } = await createSupabaseAdminClient()
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
