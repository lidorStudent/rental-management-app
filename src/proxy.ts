import { NextResponse, type NextRequest } from "next/server";

import {
  isPublicPath,
  redirectDestinationForSignedInUser,
} from "@/lib/authentication/redirectDestination";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middlewareClient";

/**
 * Next.js calls this file the proxy; it is the convention that used to be called middleware. It
 * runs before every page render and before every server action, and does two jobs.
 *
 * First it refreshes the Supabase session, which is why it has to exist at all: access tokens are
 * short lived, and only middleware can write a rotated cookie back onto the response.
 *
 * Second it decides where a request is allowed to go, on the server, before any page renders. It is
 * still not the security boundary: a request that slipped past it would meet Row Level Security in
 * the database and come back with no rows.
 */
export async function proxy(request: NextRequest) {
  const { supabaseClient, getResponse } = createSupabaseMiddlewareClient(request);
  const path = request.nextUrl.pathname;

  // getUser verifies the token with the Auth service. getSession would only decode whatever the
  // cookie claims, which is not something to route on.
  const { data: userData } = await supabaseClient.auth.getUser();

  if (userData.user === null) {
    return isPublicPath(path) ? getResponse() : redirectTo(request, "/login", getResponse());
  }

  // The role is read from the database, never from the token: a signed-in user can edit their own
  // token metadata through the Auth API, and cannot edit their profile row.
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", userData.user.id)
    .maybeSingle();

  // An account with no profile row has no role, so there is no area it belongs in. Sign it out
  // rather than letting it wander into one.
  if (profile === null) {
    await supabaseClient.auth.signOut();
    return redirectTo(request, "/login?problem=profile-missing", getResponse());
  }

  const destination = redirectDestinationForSignedInUser(
    path,
    profile.role,
    profile.must_change_password,
  );

  return destination === null ? getResponse() : redirectTo(request, destination, getResponse());
}

/**
 * Redirects while keeping any session cookie the refresh above has just written. Building a fresh
 * redirect response without copying them would throw away the rotated token and sign the user out
 * on the next request.
 */
function redirectTo(
  request: NextRequest,
  path: string,
  currentResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(new URL(path, request.url));

  for (const cookie of currentResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export const config = {
  // Everything except Next's own build output and static files. Server actions post to page routes,
  // so they pass through here too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
