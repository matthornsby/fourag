import type { MetadataRoute } from "next";
import {
  BATCH_SIZE,
  STATIC_PATHS,
  createAnonClient,
  getShardCount,
  getSitemapCounts,
} from "@/lib/sitemap-shards";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateSitemaps() {
  const shardCount = await getShardCount();
  return Array.from({ length: shardCount }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const shardId = Number(await props.id);
  const start = shardId * BATCH_SIZE;
  const end = start + BATCH_SIZE;

  const { userCount } = await getSitemapCounts();
  const supabase = createAnonClient();
  const entries: MetadataRoute.Sitemap = [];

  // Section boundaries in the flat, concatenated URL list: [static pages][user profiles][finds]
  const usersStart = STATIC_PATHS.length;
  const findsStart = usersStart + userCount;

  for (let i = Math.max(start, 0); i < Math.min(end, STATIC_PATHS.length); i++) {
    entries.push({
      url: `${SITE_URL}${STATIC_PATHS[i]}`,
      changeFrequency: "monthly",
      priority: i === 0 ? 1 : 0.6,
    });
  }

  const usersFrom = Math.max(start, usersStart) - usersStart;
  const usersTo = Math.min(end, findsStart) - usersStart;
  if (usersTo > usersFrom) {
    const { data: users } = await supabase
      .from("users")
      .select("username, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(usersFrom, usersTo - 1);

    for (const u of users ?? []) {
      entries.push({
        url: `${SITE_URL}/${u.username.toLowerCase()}`,
        lastModified: u.created_at,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  const findsFrom = Math.max(start, findsStart) - findsStart;
  const findsTo = Math.max(end, findsStart) - findsStart;
  if (findsTo > findsFrom) {
    const { data: finds } = await supabase
      .from("finds")
      .select("id, found_at, users(username)")
      .in("location_privacy", ["public", "approximate"])
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(findsFrom, findsTo - 1);

    const typedFinds = (finds ?? []) as unknown as {
      id: string;
      found_at: string;
      users: { username: string } | null;
    }[];

    for (const f of typedFinds) {
      const slug = f.users?.username.toLowerCase() ?? "anonymous";
      entries.push({
        url: `${SITE_URL}/${slug}/find/${f.id}`,
        lastModified: f.found_at,
        changeFrequency: "yearly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
