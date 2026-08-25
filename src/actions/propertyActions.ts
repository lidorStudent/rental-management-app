"use server";

import { revalidatePath } from "next/cache";

import {
  errorResult,
  successResult,
  unexpectedFailureResult,
  validationErrorResult,
  type ActionResult,
} from "@/lib/actionResult";
import { requireLandlordProfile } from "@/lib/authentication/requireLandlordProfile";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import {
  createPropertySchema,
  deletePropertySchema,
  updatePropertySchema,
  type CreatePropertyInput,
  type DeletePropertyInput,
  type UpdatePropertyInput,
} from "@/lib/validation/propertySchemas";

/**
 * Every landlord action in this project has the same seven steps, in the same order:
 *
 *   1. resolve the acting user from the session,
 *   2. refuse anyone who is not a landlord,
 *   3. parse the input with its Zod schema,
 *   4. enforce the business rules that need other rows,
 *   5. write, with Row Level Security as the last word,
 *   6. revalidate the pages whose output changed,
 *   7. return a typed result.
 *
 * Steps 1 and 2 are one call, `requireLandlordProfile`. Nothing in any action reads an owner
 * identifier out of its input: `landlord_id` always comes from the session, so a client cannot claim
 * to be somebody else by typing their id into a form.
 *
 * A row that belongs to another landlord is invisible to these queries, so it comes back as no rows
 * and produces the same "not found" message as a row that never existed. The two are deliberately
 * indistinguishable: a different message would confirm that somebody else's property exists.
 */
const PROPERTY_NOT_FOUND = "That property was not found.";

export async function createProperty(
  input: CreatePropertyInput,
): Promise<ActionResult<{ propertyId: string }>> {
  const landlord = await requireLandlordProfile();

  const parsed = createPropertySchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();
  const { data: created, error } = await supabaseClient
    .from("properties")
    .insert({
      landlord_id: landlord.id,
      name: parsed.data.name,
      address_line: parsed.data.addressLine,
      city: parsed.data.city,
      postal_code: parsed.data.postalCode ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    return unexpectedFailureResult("createProperty", error);
  }

  revalidatePath("/landlord");
  revalidatePath("/landlord/properties");

  return successResult({ propertyId: created.id });
}

export async function updateProperty(
  input: UpdatePropertyInput,
): Promise<ActionResult<{ propertyId: string }>> {
  await requireLandlordProfile();

  const parsed = updatePropertySchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();
  const { data: updated, error } = await supabaseClient
    .from("properties")
    .update({
      name: parsed.data.name,
      address_line: parsed.data.addressLine,
      city: parsed.data.city,
      postal_code: parsed.data.postalCode ?? null,
    })
    .eq("id", parsed.data.propertyId)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    return unexpectedFailureResult("updateProperty", error);
  }
  // No rows changed means the property does not exist, or belongs to someone else. The policy
  // decided which, and the caller is told neither.
  if (updated === null) {
    return errorResult(PROPERTY_NOT_FOUND);
  }

  revalidatePath("/landlord");
  revalidatePath("/landlord/properties");
  revalidatePath(`/landlord/properties/${parsed.data.propertyId}`);

  return successResult({ propertyId: updated.id });
}

/**
 * Deleting a property is blocked, not cascaded, once any of its units has ever been let.
 *
 * Units are cascaded on purpose: a unit is a room in a building and cannot outlive it. Leases are
 * not, and that is what makes the block: `leases.unit_id` is `on delete restrict`, so the database
 * would refuse the cascade anyway. Counting first turns that refusal into a sentence naming how many
 * tenancies are in the way, instead of a foreign key violation.
 */
export async function deleteProperty(input: DeletePropertyInput): Promise<ActionResult> {
  await requireLandlordProfile();

  const parsed = deletePropertySchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { data: units, error: unitsError } = await supabaseClient
    .from("units")
    .select("id")
    .eq("property_id", parsed.data.propertyId);

  if (unitsError !== null) {
    return unexpectedFailureResult("deleteProperty", unitsError);
  }

  if (units.length > 0) {
    const { count: leaseCount, error: leaseCountError } = await supabaseClient
      .from("leases")
      .select("id", { count: "exact", head: true })
      .in(
        "unit_id",
        units.map((unit) => unit.id),
      );

    if (leaseCountError !== null) {
      return unexpectedFailureResult("deleteProperty", leaseCountError);
    }
    if (leaseCount !== null && leaseCount > 0) {
      return errorResult(
        `This property cannot be deleted while ${leaseCount} ${leaseCount === 1 ? "tenancy" : "tenancies"} are recorded against its units. The rent history belongs to them.`,
      );
    }
  }

  const { data: deleted, error } = await supabaseClient
    .from("properties")
    .delete()
    .eq("id", parsed.data.propertyId)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    return unexpectedFailureResult("deleteProperty", error);
  }
  if (deleted === null) {
    return errorResult(PROPERTY_NOT_FOUND);
  }

  revalidatePath("/landlord");
  revalidatePath("/landlord/properties");

  return successResult();
}
