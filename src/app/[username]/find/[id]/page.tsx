import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { UserAvatar } from "@/components/user-avatar";
import { FINDS_TERM } from "@/lib/constants";
import { computeLuckEndDate } from "@/lib/luck";
import { luckSentence, cloverProfileSentence } from "@/lib/pronouns";
import type { Find, Clover, UserProfile } from "@/types";
import { sanitizeFinds } from "@/lib/snap-coords";
import { prettify } from "@/lib/prettify";

const LEAF_NAMES: Record<number, string> = {
  3: 'three-leaf', 4: 'four-leaf', 5: 'five-leaf', 6: 'six-leaf', 7: 'seven-leaf',
};
const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numWord(n: number) { return n < ONES.length ? ONES[n] : String(n); }
function leafName(n: number) { return LEAF_NAMES[n] ?? `${n}-leaf`; }

function cloverTitle(clovers: { leaf_count: number }[]): string {
  const freq = new Map<number, number>();
  for (const c of clovers) freq.set(c.leaf_count, (freq.get(c.leaf_count) ?? 0) + 1);
  const groups = Array.from(freq.entries()).sort((a, b) => b[0] - a[0]);
  const parts = groups.map(([count, num]) =>
    `${num === 1 ? 'a' : numWord(num)} ${leafName(count)} ${num === 1 ? 'clover' : 'clovers'}`
  );
  if (!parts.length) return 'a clover';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

function timeOfDay(dateStr: string) {
  const h = new Date(dateStr).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: find }] = await Promise.all([
    supabase.from("users").select("username").ilike("username", username).single(),
    supabase.from("finds")
      .select("photo_url, found_at, location_name, location_privacy, clovers(leaf_count)")
      .eq("id", id)
      .single(),
  ]);

  if (!profile || !find || find.location_privacy === 'private') return {};

  const displayName = profile.username.toLowerCase() === 'anonymous' ? 'Someone' : profile.username.charAt(0).toUpperCase() + profile.username.slice(1);
  const clovers = (find.clovers ?? []) as { leaf_count: number }[];
  const title = `${displayName} found ${cloverTitle(clovers)} ✤ Fourag`;
  const tod = timeOfDay(find.found_at);
  const date = formatDate(find.found_at);
  const description = `${displayName} found ${cloverTitle(clovers)}${find.location_name ? ` in ${find.location_name}` : ''} on the ${tod} of ${date}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: find.photo_url }],
    },
  };
}

interface PageProps {
  params: Promise<{ username: string; id: string }>;
}

function pageHeading(username: string, isOwner: boolean): string {
  if (isOwner) return `Your ${FINDS_TERM}`;
  const possessive = username.endsWith("s") ? `${username}'` : `${username}'s`;
  return `${possessive} ${FINDS_TERM.charAt(0).toUpperCase()}${FINDS_TERM.slice(1)}`;
}

export default async function UserFindPage({ params }: PageProps) {
  const { username, id } = await params;
  const lower = username.toLowerCase();
  if (username !== lower) redirect(`/${lower}/find/${id}`);

  const supabase = await createClient();
  const [{ data: profile }, { data: { user } }, { data: find }] = await Promise.all([
    supabase.from("users").select("*").ilike("username", username).single(),
    supabase.auth.getUser(),
    supabase.from("finds").select("id, location_privacy, user_id").eq("id", id).single(),
  ]);

  if (!profile) notFound();
  if (!find) redirect(`/${lower}`);

  if (find.location_privacy === "private" && (!user || user.id !== find.user_id)) {
    redirect(`/${lower}`);
  }

  const typedProfile = profile as UserProfile;
  const isOwner = user?.id === typedProfile.id;

  const { data: finds } = await supabase
    .from("finds")
    .select("*, clovers(*), users(username)")
    .eq("user_id", typedProfile.id)
    .in("location_privacy", ["public", "approximate"])
    .order("found_at", { ascending: false });

  const typedFinds = sanitizeFinds((finds ?? []) as (Find & { clovers: Clover[] })[], user?.id);

  const luckEndDate = computeLuckEndDate(typedFinds);
  const luckExpired = luckEndDate ? new Date(luckEndDate) < new Date() : false;
  const luckDateStr = luckEndDate
    ? (() => {
        const d = new Date(luckEndDate);
        const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
        if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
        return d.toLocaleDateString('en-US', opts);
      })()
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
  const earliestFind = typedFinds.length > 0
    ? typedFinds.reduce((earliest, f) => f.found_at < earliest ? f.found_at : earliest, typedFinds[0].found_at)
    : null;
  const sinceStr = earliestFind
    ? new Date(earliestFind).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const profileHeader = (
    <div className="flex flex-col gap-3 px-10 py-6 items-center">
      <UserAvatar username={typedProfile.username} avatarUrl={typedProfile.avatar_url} />
      <div className="flex flex-col gap-3 text-balance text-center">
        <h1 className="text-4xl font-semibold text-text-primary text-serif">
          {pageHeading(typedProfile.username, isOwner)}
        </h1>
        {typedProfile.bio && (
          <p className="text-base text-text-secondary">{prettify(typedProfile.bio)}</p>
        )}
        {totalClovers > 0 && sinceStr && bestCloverFind && bestCloverDateStr && (
          <p className="text-base text-text-secondary">
            {isOwner
              ? bestCloverFind.leafCount > 4
                ? `You found a ${bestCloverFind.leafCount}-leaf clover on ${bestCloverDateStr} and have shared ${totalClovers} ${totalClovers === 1 ? 'clover' : 'clovers'} since ${sinceStr}.`
                : `You have shared ${totalClovers} ${totalClovers === 1 ? 'clover' : 'clovers'} since ${sinceStr}.`
              : cloverProfileSentence(typedProfile.pronouns, totalClovers, sinceStr, bestCloverFind.leafCount, bestCloverDateStr)}
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
    <main className="flex-1" style={{ overflowY: 'clip' }}>
      <div className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 py-8 flex flex-col gap-6">
        {typedFinds.length === 0 ? (
          <>
            {profileHeader}
            <p className="text-sm text-text-secondary py-8 text-center">No {FINDS_TERM} yet.</p>
          </>
        ) : (
          <FindsCalendar
            finds={typedFinds}
            userId={user?.id}
            username={typedProfile.username}
            basePath={`/${lower}`}
            header={profileHeader}
            initialFindId={id}
          />
        )}
      </div>
    </main>
  );
}
