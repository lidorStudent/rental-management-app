import type { Database } from "@/types/database";

type UserRole = Database["public"]["Enums"]["user_role"];

/** Where a signed-in user belongs. One definition, used by the middleware and by every action. */
export function homePathForRole(role: UserRole): string {
  return role === "landlord" ? "/landlord" : "/tenant";
}
