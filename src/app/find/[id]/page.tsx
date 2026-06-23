import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { LuckIndicator } from "@/components/luck-indicator";
import { FINDS_TERM, SHARE_A_FIND } from "@/lib/constants";
import type { Find, Clover } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FindPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: finds },
    { data: find },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("finds")
      .select("*, clovers(*), users(username)")
      .in("location_privacy", ["public", "approximate"])
      .eq("status", "approved")
      .order("found_at", { ascending: false }),
    supabase
      .from("finds")
      .select("id, location_privacy, user_id")
      .eq("id", id)
      .single(),
  ]);

  if (!find) redirect("/");

  // Privacy gate: private finds redirect to home
  if (
    find.location_privacy === "private" &&
    (!user || user.id !== find.user_id)
  ) {
    redirect("/");
  }

  const typedFinds = (finds ?? []) as (Find & { clovers: Clover[] })[];
  const userFinds = user ? typedFinds.filter((f) => f.user_id === user.id) : [];

  return (
    <main className="flex-1" style={{ overflowY: 'clip' }}>
      <div className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 py-8 flex flex-col gap-6">
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
              {SHARE_A_FIND}
            </Link>
          )}
        </div>

        {typedFinds.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-text-secondary text-sm">No {FINDS_TERM} yet.</p>
          </div>
        ) : (
          <FindsCalendar finds={typedFinds} userId={user?.id} initialFindId={id} />
        )}
      </div>
    </main>
  );
}
