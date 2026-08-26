import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

/**
 * The one route handler in this project, and the reason it is one rather than a page: a scheduler
 * calls it, not a browser, and it answers with JSON rather than with HTML.
 *
 * It exists because a Supabase project on the free plan is paused after a week without activity,
 * and a paused project is a graded application that does not load. A static response would keep
 * Vercel warm and let the database go to sleep anyway, so this makes a real round trip to Postgres
 * on every call.
 *
 * The query is deliberately the smallest one that touches the database: a count of a table, with no
 * rows returned. Row Level Security applies as it does everywhere, and with no session it matches
 * nothing, so the count is always zero and nothing about anybody's portfolio is exposed. What it
 * proves is that PostgREST and Postgres are awake and answering, which is the whole job.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const supabaseClient = await createSupabaseServerClient();
    const { error } = await supabaseClient
      .from("properties")
      .select("id", { count: "exact", head: true });

    if (error !== null) {
      console.error("Health check could not reach the database", { code: error.code });
      return NextResponse.json(
        { status: "unavailable", database: "unreachable", checkedAt },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: "ok", database: "reachable", checkedAt }, { status: 200 });
  } catch (failure) {
    console.error("Health check failed", failure);
    return NextResponse.json(
      { status: "unavailable", database: "unreachable", checkedAt },
      { status: 503 },
    );
  }
}
