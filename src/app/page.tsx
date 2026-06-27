import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { HomepageContent } from "@/components/homepage-content";
import { computeLuckEndDate } from "@/lib/luck";
import type { Find, Clover, UserProfile } from "@/types";
import { SITE_TAGLINE } from "@/lib/constants";
import { sanitizeFinds } from "@/lib/snap-coords";

export const metadata: Metadata = {
  title: `✤ Fourag: ${SITE_TAGLINE}`,
  description: "Fourag is a public patch for spreading the serendipity of four-leaf (or even more-leaf) clovers.",
};

export default async function Home() {
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: finds },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("finds")
      .select("*, clovers(*)")
      .in("location_privacy", ["public", "approximate"])
      .eq("status", "approved")
      .order("found_at", { ascending: false }),
  ]);

  const typedFinds = sanitizeFinds((finds ?? []) as (Find & { clovers: Clover[] })[], user?.id);

  // 2 most recent unique users
  const seenUserIds = new Set<string>();
  const recentUserIds: string[] = [];
  for (const find of typedFinds) {
    if (find.user_id && !seenUserIds.has(find.user_id)) {
      seenUserIds.add(find.user_id);
      recentUserIds.push(find.user_id);
      if (recentUserIds.length === 2) break;
    }
  }

  const { data: profileRows } = recentUserIds.length > 0
    ? await supabase.from("users").select("*").in("id", recentUserIds)
    : { data: [] };

  const profiles = (profileRows ?? []) as UserProfile[];
  const sortedProfiles = recentUserIds
    .map(id => profiles.find(p => p.id === id))
    .filter(Boolean) as UserProfile[];

  const findsByUser: Record<string, (Find & { clovers: Clover[] })[]> = {};
  const luckEndDates: Record<string, string | null> = {};
  for (const profile of sortedProfiles) {
    const userFinds = typedFinds.filter(f => f.user_id === profile.id);
    findsByUser[profile.id] = userFinds;
    luckEndDates[profile.id] = computeLuckEndDate(userFinds);
  }

  // Append anonymous profile card if there are any approved anonymous finds
  const anonymousFinds = typedFinds.filter(f => f.user_id === null);
  if (anonymousFinds.length > 0) {
    const anonymousProfile: UserProfile = {
      id: 'anonymous',
      username: 'anonymous',
      avatar_url: null,
      bio: 'Finds shared without an account.',
      trusted: false,
      is_admin: false,
      created_at: '',
      pronouns: 'none',
    };
    sortedProfiles.push(anonymousProfile);
    findsByUser['anonymous'] = anonymousFinds;
    luckEndDates['anonymous'] = computeLuckEndDate(anonymousFinds);
  }

  const heroFinds = [...typedFinds]
    .filter(f => f.photo_url)
    .sort((a, b) => {
      const score = (f: Find & { clovers: Clover[] }) =>
        (f.clovers ?? []).reduce((sum, c) => sum + c.leaf_count, 0);
      return score(b) - score(a);
    })
    .slice(0, 6);

  const mappableFinds = typedFinds
    .filter(f => f.lat !== null && f.lng !== null)
    .slice(0, 50);

  return (
    <main className="flex-1">
      <HomepageContent
        userId={user?.id ?? null}
        heroFinds={heroFinds}
        profiles={sortedProfiles}
        findsByUser={findsByUser}
        luckEndDates={luckEndDates}
        mappableFinds={mappableFinds}
      />
    </main>
  );
}
