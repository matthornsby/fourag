import { createClient } from "@supabase/supabase-js";

// Google's limit is 50,000 URLs per sitemap file; stay well under it.
export const BATCH_SIZE = 45000;
export const STATIC_PATHS = ["", "/about", "/privacy"];

// A plain, anonymous client (no cookies): the sitemap is the same for every
// visitor and generateSitemaps runs at build time, where request-scoped
// cookies() isn't available anyway.
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export async function getSitemapCounts() {
  const supabase = createAnonClient();
  const [{ count: userCount }, { count: findCount }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("finds")
      .select("id", { count: "exact", head: true })
      .in("location_privacy", ["public", "approximate"])
      .eq("status", "approved"),
  ]);
  return { userCount: userCount ?? 0, findCount: findCount ?? 0 };
}

export async function getShardCount() {
  const { userCount, findCount } = await getSitemapCounts();
  const total = STATIC_PATHS.length + userCount + findCount;
  return Math.max(1, Math.ceil(total / BATCH_SIZE));
}
