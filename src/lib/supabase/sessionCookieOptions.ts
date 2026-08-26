import type { CookieOptions } from "@supabase/ssr";

/**
 * The flags this project puts on the Supabase session cookie, in one place because two files write
 * that cookie: the server client when somebody signs in, and the proxy client when a token is
 * refreshed.
 *
 * `@supabase/ssr` deliberately leaves the cookie readable by page JavaScript, because its browser
 * client hydrates the session from `document.cookie`. This project never uses that client: every
 * read happens in a server component and every write in a server action, so the session is only
 * ever read on the server, where `httpOnly` makes no difference to us and a great deal of
 * difference to an injected script.
 *
 * The cookie holds the access token and the refresh token. Without `httpOnly`, one line of injected
 * JavaScript could take both and keep using the refresh token long after the page was closed.
 *
 * `secure` is set only in production because a Secure cookie is not sent over plain HTTP, and local
 * development is served over HTTP. `sameSite: "lax"` is what the library already used; it is stated
 * here so that all three flags are visible together rather than two being explicit and one implied.
 */
export function hardenedSessionCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}
