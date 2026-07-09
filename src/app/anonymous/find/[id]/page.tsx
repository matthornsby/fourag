import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { UserAvatar } from "@/components/user-avatar";
import { InterrobangIcon } from "@/components/icons/interrobang";
import { FINDS_TERM } from "@/lib/constants";
import type { Find, Clover } from "@/types";
import { sanitizeFinds } from "@/lib/snap-coords";

interface PageProps {
  params: Promise<{ id: string }>;
}

const LEAF_NAMES: Record<number, string> = {
  3: 'three-leaf', 4: 'four-leaf', 5: 'five-leaf', 6: 'six-leaf', 7: 'seven-leaf',
};
const NUM_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numWord(n: number) { return n < NUM_WORDS.length ? NUM_WORDS[n] : String(n); }
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
  const { id } = await params;
  const supabase = await createClient();
  const { data: find } = await supabase
    .from("finds")
    .select("photo_url, found_at, location_name, location_privacy, clovers(leaf_count)")
    .eq("id", id)
    .is("user_id", null)
    .single();

  if (!find || find.location_privacy === 'private') return {};

  const clovers = (find.clovers ?? []) as { leaf_count: number }[];
  const title = `Someone found ${cloverTitle(clovers)} ✤ Fourag`;
  const tod = timeOfDay(find.found_at);
  const date = formatDate(find.found_at);
  const description = find.location_name
    ? `The ${tod} of ${date} in ${find.location_name}.`
    : `The ${tod} of ${date}.`;

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

export default async function AnonymousFindPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: find }, { data: { user } }] = await Promise.all([
    supabase.from("finds").select("id, location_privacy, user_id").eq("id", id).is("user_id", null).single(),
    supabase.auth.getUser(),
  ]);

  if (!find) notFound();
  if (find.location_privacy === 'private' && !user) redirect('/anonymous');

  const { data: finds } = await supabase
    .from("finds")
    .select("*, clovers(*)")
    .is("user_id", null)
    .in("location_privacy", ["public", "approximate"])
    .eq("status", "approved")
    .order("found_at", { ascending: false });

  const typedFinds = sanitizeFinds((finds ?? []) as (Find & { clovers: Clover[] })[], null);

  const totalClovers = typedFinds.reduce((sum, f) => sum + (f.clovers ?? []).length, 0);
  const earliestFind = typedFinds.length > 0
    ? typedFinds.reduce((earliest, f) => f.found_at < earliest ? f.found_at : earliest, typedFinds[0].found_at)
    : null;
  const sinceStr = earliestFind
    ? new Date(earliestFind).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

  const noun = totalClovers === 1 ? 'clover' : 'clovers';
  const anonSentence = totalClovers > 0 && sinceStr
    ? bestCloverFind && bestCloverFind.leafCount > 4 && bestCloverDateStr
      ? `${totalClovers} ${noun} have been shared anonymously since ${sinceStr}, including a ${bestCloverFind.leafCount}-leaf clover on ${bestCloverDateStr}.`
      : `${totalClovers} ${noun} have been shared anonymously since ${sinceStr}.`
    : null;

  const profileHeader = (
    <div className="flex flex-col gap-3 px-10 py-6 items-center">
      <UserAvatar username="anonymous" fallback={<InterrobangIcon />} size="" style={{
        width: 'calc(var(--text-base) * 5)',
        height: 'calc(var(--text-base) * 5)',
        fontSize: 'calc(var(--text-base) * 2)',
      }} />
      <div className="flex flex-col gap-3 text-balance text-center">
        <h1 className="text-4xl font-semibold text-text-primary text-serif">
          Anonymous {FINDS_TERM.charAt(0).toUpperCase()}{FINDS_TERM.slice(1)}
        </h1>
        {anonSentence && (
          <p className="text-base text-text-secondary">{anonSentence}</p>
        )}
      </div>
    </div>
  );

  return (
    <main className="flex-1" style={{ overflowY: "clip" }}>
      <div className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 py-8 flex flex-col gap-6">
        {typedFinds.length === 0 ? (
          <>
            {profileHeader}
            <p className="text-sm text-text-secondary py-8 text-center">
              No anonymous {FINDS_TERM} yet.
            </p>
          </>
        ) : (
          <FindsCalendar
            finds={typedFinds}
            basePath="/anonymous"
            header={profileHeader}
            initialFindId={id}
          />
        )}
      </div>
    </main>
  );
}
