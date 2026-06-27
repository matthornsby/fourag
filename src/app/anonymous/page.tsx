import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { UserAvatar } from "@/components/user-avatar";
import { InterrobangIcon } from "@/components/icons/interrobang";
import { FINDS_TERM } from "@/lib/constants";
import type { Find, Clover } from "@/types";
import { sanitizeFinds } from "@/lib/snap-coords";

export const metadata: Metadata = {
  title: "Anonymous Finds ✤ Fourag",
  description: "Clover finds shared without an account — a public patch of serendipity from unknown foragers.",
  openGraph: {
    title: "Anonymous Finds ✤ Fourag",
    description: "Clover finds shared without an account — a public patch of serendipity from unknown foragers.",
  },
};

export default async function AnonymousPage() {
  const supabase = await createClient();

  const { data: finds } = await supabase
    .from("finds")
    .select("*, clovers(*)")
    .is("user_id", null)
    .in("location_privacy", ["public", "approximate"])
    .eq("status", "approved")
    .order("found_at", { ascending: false });

  const typedFinds = sanitizeFinds((finds ?? []) as (Find & { clovers: Clover[] })[], null);

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

  const noun = (n: number) => n === 1 ? 'clover' : 'clovers';
  const showSplit = hasPreviousYear && thisYearClovers > 0;
  const anonSentence = totalClovers > 0 && sinceStr
    ? (() => {
        const hasBest = bestCloverFind && bestCloverFind.leafCount > 4 && bestCloverDateStr;
        const including = hasBest ? `, including a ${bestCloverFind!.leafCount}-leaf clover on ${bestCloverDateStr}` : '';
        if (showSplit)
          return `${thisYearClovers} ${noun(thisYearClovers)} have been shared anonymously this year, and ${totalClovers} since ${sinceStr}${including}.`;
        return `${totalClovers} ${noun(totalClovers)} have been shared anonymously since ${sinceStr}${including}.`;
      })()
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
          />
        )}
      </div>
    </main>
  );
}
