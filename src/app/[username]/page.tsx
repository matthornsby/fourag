import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { FINDS_TERM } from "@/lib/constants";
import { UserAvatar } from "@/components/user-avatar";
import { computeLuckEndDate } from "@/lib/luck";
import { luckSentence, cloverProfileSentence } from "@/lib/pronouns";
import type { Find, Clover, UserProfile } from "@/types";
import { sanitizeFinds } from "@/lib/snap-coords";
import { prettify } from "@/lib/prettify";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ find?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users").select("id, username, bio, avatar_url").ilike("username", username).single();

  if (!profile) return {};

  const { data: recentFind } = await supabase
    .from("finds").select("photo_url").eq("user_id", profile.id)
    .order("found_at", { ascending: false }).limit(1).single();

  const displayName = profile.username.charAt(0).toUpperCase() + profile.username.slice(1);
  const title = `${displayName}'s ${FINDS_TERM.charAt(0).toUpperCase() + FINDS_TERM.slice(1)} ✤ Fourag`;
  const description = profile.bio ?? `${displayName}'s clover finds on Fourag.`;
  const image = profile.avatar_url ?? recentFind?.photo_url ?? null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : [],
    },
  };
}

function pageHeading(username: string, isOwner: boolean): string {
  if (isOwner) return `Your ${FINDS_TERM}`;
  const possessive = username.endsWith("s") ? `${username}’` : `${username}’s`;
  return `${possessive} ${FINDS_TERM.charAt(0).toUpperCase()}${FINDS_TERM.slice(1)}`;
}

export default async function UserProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const { find: initialFindId } = await searchParams;
  if (username !== username.toLowerCase()) redirect(`/${username.toLowerCase()}`);
  const supabase = await createClient();

  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase.from("users").select("*").ilike("username", username).single(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();

  const typedProfile = profile as UserProfile;
  const isOwner = user?.id === typedProfile.id;

  const privacyFilter = isOwner
    ? ["public", "approximate", "private"]
    : ["public", "approximate"];

  const { data: finds } = await supabase
    .from("finds")
    .select("*, clovers(*), users(username)")
    .eq("user_id", typedProfile.id)
    .in("location_privacy", privacyFilter)
    .order("found_at", { ascending: false });

  const typedFinds = sanitizeFinds((finds ?? []) as (Find & { clovers: Clover[] })[], user?.id);

  const luckEndDate = computeLuckEndDate(typedFinds);
  const luckExpired = luckEndDate ? new Date(luckEndDate) < new Date() : false;
  const possessive = typedProfile.username.endsWith('s')
    ? `${typedProfile.username}’`
    : `${typedProfile.username}’s`;
  const luckDateStr = luckEndDate
    ? new Date(luckEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  const bestCloverFind = typedFinds.reduce<{ leafCount: number; foundAt: string } | null>(
    (best, find) => {
      const max = (find.clovers ?? []).reduce((m, c) => Math.max(m, c.leaf_count), 0);
      if (max > (best?.leafCount ?? 0)) return { leafCount: max, foundAt: find.found_at };
      return best;
    },
    null
  );
  const bestCloverDateStr = bestCloverFind
    ? (() => {
        const d = new Date(bestCloverFind.foundAt);
        const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
        return d.toLocaleDateString('en-US', opts);
      })()
    : null;

  const totalClovers = typedFinds.reduce((sum, f) => sum + (f.clovers ?? []).length, 0);
  const currentYear = new Date().getFullYear();
  const hasPreviousYear = typedFinds.some(f => new Date(f.found_at).getFullYear() < currentYear);
  const thisYearClovers = typedFinds
    .filter(f => new Date(f.found_at).getFullYear() === currentYear)
    .reduce((sum, f) => sum + (f.clovers ?? []).length, 0);
  const earliestFind = typedFinds.length > 0
    ? typedFinds.reduce((earliest, f) => f.found_at < earliest ? f.found_at : earliest, typedFinds[0].found_at)
    : null;
  const sinceStr = earliestFind
    ? new Date(earliestFind).toLocaleDateString('en-US', { month: 'long', ...(hasPreviousYear ? { year: 'numeric' } : {}) })
    : null;

  const profileHeader = (
    <div className="flex flex-col gap-3 px-5 sm:px-7 py-6 items-center">
      <UserAvatar username={typedProfile.username} avatarUrl={typedProfile.avatar_url} />
      <div className="flex flex-col gap-3 text-balance text-center">
        <h1 className="text-4xl font-semibold text-text-primary text-serif">
          {pageHeading(typedProfile.username, isOwner)}
        </h1>
        {typedProfile.bio && (
          <p className="text-base sm:text-lg text-text-secondary">{prettify(typedProfile.bio)}</p>
        )}
        {totalClovers > 0 && sinceStr && bestCloverFind && bestCloverDateStr && (
          <p className="text-base text-text-secondary">
            {isOwner
              ? (() => {
                  const noun = (n: number) => n === 1 ? 'clover' : 'clovers'
                  const showSplit = hasPreviousYear && thisYearClovers > 0
                  if (bestCloverFind.leafCount > 4) {
                    if (showSplit)
                      return `You found a ${bestCloverFind.leafCount}-leaf clover on ${bestCloverDateStr}, have shared ${thisYearClovers} ${noun(thisYearClovers)} this year, and ${totalClovers} since ${sinceStr}.`
                    return `You found a ${bestCloverFind.leafCount}-leaf clover on ${bestCloverDateStr} and have shared ${totalClovers} ${noun(totalClovers)} since ${sinceStr}.`
                  }
                  if (showSplit)
                    return `You have shared ${thisYearClovers} ${noun(thisYearClovers)} this year, and ${totalClovers} since ${sinceStr}.`
                  return `You have shared ${totalClovers} ${noun(totalClovers)} since ${sinceStr}.`
                })()
              : cloverProfileSentence(typedProfile.pronouns, totalClovers, sinceStr, bestCloverFind.leafCount, bestCloverDateStr, thisYearClovers, hasPreviousYear)}
          </p>
        )}
        {luckDateStr && (
          <p className="text-base text-text-secondary">
            {isOwner
              ? `Your luck ${luckExpired ? 'ran' : 'runs'} out on ${luckDateStr}.`
              : luckSentence(typedProfile.pronouns, luckExpired ? 'ran' : 'runs', luckDateStr)}
          </p>
        )}
        {isOwner && (
          <p>
        <Link
          href="/account/profile"
          className="self-start text-sm button button-secondary text-center hover:text-text-primary transition-colors duration-150"
        >
          Edit your profile details
        </Link>
        </p>
      )}
      </div>
      
    </div>
  );

  return (
    <main className="flex-1" style={{ overflowX: 'clip', overflowY: 'clip' }}>
      <div className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 py-8 flex flex-col gap-6">
        {typedFinds.length === 0 ? (
          <>
            {profileHeader}
            <p className="text-sm text-text-secondary py-8 text-center">
              No {FINDS_TERM} yet.
            </p>
          </>
        ) : (
          <FindsCalendar finds={typedFinds} userId={user?.id} username={typedProfile.username} basePath={`/${typedProfile.username}`} header={profileHeader} initialFindId={initialFindId} />
        )}
      </div>
    </main>
  );
}
