import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { LuckIndicator } from "@/components/luck-indicator";
import { FINDS_TERM } from "@/lib/constants";
import type { Find, Clover } from "@/types";

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
      .order("found_at", { ascending: false }),
  ]);

  const typedFinds = (finds ?? []) as (Find & { clovers: Clover[] })[];

  const userFinds = user
    ? typedFinds.filter((f) => f.user_id === user.id)
    : [];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-text-primary">
              All {FINDS_TERM}
            </h1>
            {user && <LuckIndicator finds={userFinds} />}
          </div>
          {user && (
            <Link
              href="/account/finds/new"
              className="shrink-0 inline-flex items-center rounded-md bg-accent text-contrast text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150"
            >
              Log a find
            </Link>
          )}
        </div>

        {typedFinds.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-text-secondary text-sm">No {FINDS_TERM} yet.</p>
            {user ? (
              <Link
                href="/account/finds/new"
                className="text-sm text-accent hover:underline underline-offset-2"
              >
                Log a find
              </Link>
            ) : (
              <Link
                href="/auth/sign-up"
                className="text-sm text-accent hover:underline underline-offset-2"
              >
                Get started
              </Link>
            )}
          </div>
        ) : (
          <FindsCalendar finds={typedFinds} />
        )}
      </div>
    </main>
  );
}
