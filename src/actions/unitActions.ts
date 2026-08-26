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
  createUnitSchema,
  deleteUnitSchema,
  updateUnitSchema,
  type CreateUnitInput,
  type DeleteUnitInput,
  type UpdateUnitInput,
} from "@/lib/validation/unitSchemas";

/** The seven steps are described at the top of propertyActions.ts. */

const UNIT_NOT_FOUND = "That unit was not found.";
const PROPERTY_NOT_FOUND = "That property was not found.";
const DUPLICATE_LABEL_CODE = "23505";
const DUPLICATE_LABEL_MESSAGE =
  "This property already has a unit with that label. Use a label you can tell apart at a glance.";

export async function createUnit(
  input: CreateUnitInput,
): Promise<ActionResult<{ unitId: string }>> {
  const landlord = await requireLandlordProfile();

  const parsed = createUnitSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  // The property is read as the acting landlord, so this both finds it and proves it is theirs.
  // Without it the insert would still be refused, by the units_insert_own policy, but with a
  // constraint error rather than a sentence.
  const { data: property, error: propertyError } = await supabaseClient
    .from("properties")
    .select("id")
    .eq("id", parsed.data.propertyId)
    .maybeSingle();

  if (propertyError !== null) {
    return unexpectedFailureResult("createUnit", propertyError);
  }
  if (property === null) {
    return errorResult(PROPERTY_NOT_FOUND);
  }

  const { data: created, error } = await supabaseClient
    .from("units")
    .insert({
      property_id: property.id,
      landlord_id: landlord.id,
      label: parsed.data.label,
      bedroom_count: parsed.data.bedroomCount ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    if (error?.code === DUPLICATE_LABEL_CODE) {
      return errorResult(DUPLICATE_LABEL_MESSAGE, { label: DUPLICATE_LABEL_MESSAGE });
    }
    return unexpectedFailureResult("createUnit", error);
  }

  revalidatePath("/landlord");
  revalidatePath(`/landlord/properties/${property.id}`);

  return successResult({ unitId: created.id });
}

export async function updateUnit(
  input: UpdateUnitInput,
): Promise<ActionResult<{ unitId: string }>> {
  await requireLandlordProfile();

  const parsed = updateUnitSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();
  const { data: updated, error } = await supabaseClient
    .from("units")
    .update({
      label: parsed.data.label,
      bedroom_count: parsed.data.bedroomCount ?? null,
    })
    .eq("id", parsed.data.unitId)
    .select("id, property_id")
    .maybeSingle();

  if (error !== null) {
    if (error.code === DUPLICATE_LABEL_CODE) {
      return errorResult(DUPLICATE_LABEL_MESSAGE, { label: DUPLICATE_LABEL_MESSAGE });
    }
    return unexpectedFailureResult("updateUnit", error);
  }
  if (updated === null) {
    return errorResult(UNIT_NOT_FOUND);
  }

  revalidatePath("/landlord");
  revalidatePath(`/landlord/properties/${updated.property_id}`);

  return successResult({ unitId: updated.id });
}

/**
 * Blocked, never cascaded, once the unit has ever been let. Every payment and every reported problem
 * hangs off a lease, and every lease hangs off the unit, so removing it would take a rent history
 * with it. `leases.unit_id` is `on delete restrict` for the same reason; counting first turns the
 * database's refusal into a sentence that says how many tenancies are in the way.
 */
export async function deleteUnit(input: DeleteUnitInput): Promise<ActionResult> {
  await requireLandlordProfile();

  const parsed = deleteUnitSchema.safeParse(input);
  if (!parsed.success) {
    return validationErrorResult(parsed.error);
  }

  const supabaseClient = await createSupabaseServerClient();

  const { count: leaseCount, error: leaseCountError } = await supabaseClient
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", parsed.data.unitId);

  if (leaseCountError !== null) {
    return unexpectedFailureResult("deleteUnit", leaseCountError);
  }
  if (leaseCount !== null && leaseCount > 0) {
    return errorResult(
      `This unit cannot be deleted while ${leaseCount} ${leaseCount === 1 ? "tenancy is" : "tenancies are"} recorded against it. The rent history belongs to them.`,
    );
  }

  const { data: deleted, error } = await supabaseClient
    .from("units")
    .delete()
    .eq("id", parsed.data.unitId)
    .select("id, property_id")
    .maybeSingle();

  if (error !== null) {
    return unexpectedFailureResult("deleteUnit", error);
  }
  if (deleted === null) {
    return errorResult(UNIT_NOT_FOUND);
  }

  revalidatePath("/landlord");
  revalidatePath(`/landlord/properties/${deleted.property_id}`);

  return successResult();
}
