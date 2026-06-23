import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import type { Find, Clover } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnonymousFindPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: finds }, { data: find }] = await Promise.all([
    supabase
      .from("finds")
      .select("*, clovers(*)")
      .is("user_id", null)
      .in("location_privacy", ["public", "approximate"])
      .eq("status", "approved")
      .order("found_at", { ascending: false }),
    supabase
      .from("finds")
      .select("id, location_privacy, user_id")
      .eq("id", id)
      .single(),
  ]);

  if (!find || find.user_id !== null) redirect("/anonymous");

  if (find.location_privacy === "private") redirect("/anonymous");

  const typedFinds = (finds ?? []) as (Find & { clovers: Clover[] })[];

  return (
    <main className="flex-1" style={{ overflowY: "clip" }}>
      <div className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-text-primary">
            Anonymous finds
          </h1>
          <p className="text-sm text-text-secondary">
            Finds shared without an account.
          </p>
        </div>

        <FindsCalendar
          finds={typedFinds}
          basePath="/anonymous"
          initialFindId={id}
        />
      </div>
    </main>
  );
}
