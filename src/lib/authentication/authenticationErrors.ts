/**
 * The three ways establishing the acting user can fail. They are classes rather than strings so
 * that a caller can tell them apart with `instanceof` and react differently to each.
 */

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("There is no signed-in user for this request.");
    this.name = "AuthenticationRequiredError";
  }
}

/**
 * An account exists in Supabase Auth but has no row in public.profiles. The database trigger
 * creates that row whenever an account is created, so this means either the trigger was bypassed
 * or the row was deleted. The user cannot be given a role, so they cannot be let in.
 */
export class ProfileMissingError extends Error {
  constructor(userId: string) {
    super(`The signed-in account ${userId} has no profile row.`);
    this.name = "ProfileMissingError";
  }
}

export class RoleMismatchError extends Error {
  constructor(requiredRole: string, actualRole: string) {
    super(`This action is for a ${requiredRole}, and the signed-in user is a ${actualRole}.`);
    this.name = "RoleMismatchError";
  }
}
