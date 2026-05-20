import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { FindsCalendar } from "@/components/finds-calendar";
import { FINDS_TERM } from "@/lib/constants";
import type { Find, Clover, UserProfile } from "@/types";

interface PageProps {
  params: Promise<{ username: string }>;
}

function pageHeading(username: string, isOwner: boolean): string {
  if (isOwner) return `Your ${FINDS_TERM}`;
  const possessive = username.endsWith("s") ? `${username}'` : `${username}'s`;
  return `${possessive} ${FINDS_TERM.charAt(0).toUpperCase()}${FINDS_TERM.slice(1)}`;
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase.from("users").select("*").eq("username", username).single(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();

  const typedProfile = profile as UserProfile;
  const isOwner = user?.id === typedProfile.id;

  const { data: finds } = await supabase
    .from("finds")
    .select("*, clovers(*)")
    .eq("user_id", typedProfile.id)
    .in("location_privacy", ["public", "approximate"])
    .order("found_at", { ascending: false });

  const typedFinds = (finds ?? []) as (Find & { clovers: Clover[] })[];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-text-primary">
            {pageHeading(typedProfile.username, isOwner)}
          </h1>
          {typedProfile.bio && (
            <p className="text-sm text-text-secondary">{typedProfile.bio}</p>
          )}
        </div>

        {typedFinds.length === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">
            No {FINDS_TERM} yet.
          </p>
        ) : (
          <FindsCalendar finds={typedFinds} />
        )}
      </div>
    </main>
  );
}
