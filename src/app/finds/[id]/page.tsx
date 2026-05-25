import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import type { Find, Clover } from "@/types";
import { CloverMarker } from "@/components/clover-marker";
import { markerRotation } from "@/lib/marker-rotation";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `Found ${day} at ${time}`;
}

function fuzzyCoords(lat: number, lng: number, findId: string) {
  const seed = findId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const offsetLat = ((seed % 100) - 50) / 10000;
  const offsetLng = (((seed * 7) % 100) - 50) / 10000;
  return { lat: lat + offsetLat, lng: lng + offsetLng };
}

export default async function FindPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: find } = await supabase
    .from("finds")
    .select("*, clovers(*)")
    .eq("id", id)
    .single();

  if (!find) redirect("/");

  const typedFind = find as Find & { clovers: Clover[] };

  // Privacy gate: private finds are only visible to their owner
  if (
    typedFind.location_privacy === "private" &&
    (!user || user.id !== typedFind.user_id)
  ) {
    redirect("/");
  }

  const isOwner = user?.id === typedFind.user_id;

  // Compute display coordinates
  let displayCoords: { lat: number; lng: number } | null = null;
  if (typedFind.lat !== null && typedFind.lng !== null) {
    if (typedFind.location_privacy === "approximate") {
      displayCoords = fuzzyCoords(typedFind.lat, typedFind.lng, typedFind.id);
    } else if (typedFind.location_privacy === "public") {
      displayCoords = { lat: typedFind.lat, lng: typedFind.lng };
    }
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-[680px] px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Back link */}
        <Link
          href="/"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150 self-start"
        >
          ← All finds
        </Link>

        {/* Photo with annotation markers */}
        <div className="relative w-full rounded-lg overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={typedFind.photo_url}
            alt="Clover find"
            className="w-full h-auto block"
          />
          {typedFind.clovers.map((clover, i) =>
            clover.annotation_x !== null && clover.annotation_y !== null ? (
              <div
                key={clover.id}
                className="absolute select-none pointer-events-none"
                style={{
                  left: `${clover.annotation_x * 100}%`,
                  top: `${clover.annotation_y * 100}%`,
                  width: `${(clover.annotation_radius ?? 0.09) * 200}%`,
                  aspectRatio: '1',
                  filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))',
                  transform: `translate(-50%, -50%)`,
                }}
              >
                <CloverMarker
                  leafCount={clover.leaf_count}
                  rotation={clover.annotation_rotation ?? markerRotation(typedFind.id, i)}
                />
              </div>
            ) : null
          )}
        </div>

        {/* Find details */}
        <div className="flex flex-col gap-4">
          {/* Date */}
          <p className="text-sm text-text-secondary">
            {formatDateTime(typedFind.found_at)}
          </p>

          {/* Clovers */}
          {typedFind.clovers.length > 0 && (
            <ul className="flex flex-col gap-1">
              {typedFind.clovers.map((clover, i) => (
                <li key={clover.id} className="text-sm text-text-primary">
                  Clover {String.fromCharCode(65 + i)} · {clover.leaf_count} leaves
                </li>
              ))}
            </ul>
          )}

          {/* Notes */}
          {typedFind.notes && (
            <p className="text-sm text-text-primary pl-3 border-l border-border">
              {typedFind.notes}
            </p>
          )}

          {/* Location */}
          {displayCoords && (
            <p className="text-sm text-text-secondary">
              {typedFind.location_name ?? `${displayCoords.lat.toFixed(5)}, ${displayCoords.lng.toFixed(5)}`}
              {typedFind.location_privacy === "approximate" && (
                <span className="ml-1">(approximate)</span>
              )}
            </p>
          )}
        </div>

        {/* Owner controls */}
        {isOwner && (
          <div className="pt-2 border-t border-border">
            <Link
              href={`/account/finds/${typedFind.id}/edit`}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Edit
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
