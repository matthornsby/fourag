import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { FindCard } from "@/components/find-card";
import { LuckIndicator } from "@/components/luck-indicator";
import type { Find, Clover } from "@/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: finds } = await supabase
      .from("finds")
      .select("*, clovers(*)")
      .eq("user_id", user.id)
      .order("found_at", { ascending: false });

    const typedFinds = (finds ?? []) as (Find & { clovers: Clover[] })[];
    const lastFindAt = typedFinds[0]?.found_at ?? null;

    return (
      <main className="flex-1">
        <div className="mx-auto max-w-[680px] px-4 sm:px-6 py-8 flex flex-col gap-6">
          {/* Page header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-text-primary">
                Your finds
              </h1>
              <LuckIndicator lastFindAt={lastFindAt} />
            </div>
            <Link
              href="/account/finds/new"
              className="shrink-0 inline-flex items-center rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150"
            >
              Log a find
            </Link>
          </div>

          {/* Finds list or empty state */}
          {typedFinds.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-text-secondary text-sm">
                No finds yet. Step outside.
              </p>
              <Link
                href="/account/finds/new"
                className="text-sm text-accent hover:underline underline-offset-2"
              >
                Log a find
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {typedFinds.map((find) => (
                <FindCard key={find.id} find={find} />
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center gap-4">
      <h1 className="text-2xl font-semibold">Fourag</h1>
      <p className="text-text-secondary text-sm max-w-xs">
        A field journal for four-leaf clovers — and the rare few beyond.
      </p>
      <div className="flex gap-3 mt-2">
        <Link
          href="/auth/sign-in"
          className="rounded-md border border-border bg-surface text-text-primary text-sm font-medium px-4 py-2 hover:border-accent transition-colors duration-150"
        >
          Sign in
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
