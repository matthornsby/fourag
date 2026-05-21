import Link from "next/link";
import { Lock, MapPin } from "lucide-react";
import type { Find, Clover } from "@/types";
import { CloverMarker } from "@/components/clover-marker";
import { markerRotation } from "@/lib/marker-rotation";
import { cloverPath } from "@/lib/clover-path";

interface FindCardProps {
  find: Find & { clovers: Clover[] };
}

function groupLeafCounts(clovers: Clover[]): { count: number; num: number }[] {
  const freq = new Map<number, number>()
  for (const c of clovers) freq.set(c.leaf_count, (freq.get(c.leaf_count) ?? 0) + 1)
  return Array.from(freq.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([count, num]) => ({ count, num }))
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));
}

function cloverSummary(clovers: Clover[]): string {
  if (clovers.length === 0) return "";
  if (clovers.length === 1) {
    return `${clovers[0].leaf_count}-leaf clover`;
  }
  const leafCounts = clovers.map((c) => c.leaf_count).join(" + ");
  return `${clovers.length} clovers · ${leafCounts} leaves`;
}

export function FindCard({ find }: FindCardProps) {
  const summary = cloverSummary(find.clovers);
  const privacy = find.location_privacy;
  const hasLocation = find.lat !== null && find.lng !== null && privacy !== "private";
  const leafGroups = groupLeafCounts(find.clovers);

  return (
    <Link
      href={`/finds/${find.id}`}
      className="block border border-border rounded-lg overflow-hidden hover:border-accent transition-colors duration-150 max-w-[400px]"
    >
      {/* Photo with annotation markers */}
      <div className="relative bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={find.photo_url}
          alt={summary || "Clover find"}
          loading="lazy"
          className="w-full h-auto block"
        />
        {find.clovers.map((clover, i) =>
          clover.annotation_x !== null && clover.annotation_y !== null ? (
            <div
              key={clover.id}
              className="absolute select-none pointer-events-none"
              style={{
                left: `${clover.annotation_x * 100}%`,
                top: `${clover.annotation_y * 100}%`,
                width: '18%',
                aspectRatio: '1',
                filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <CloverMarker
                leafCount={clover.leaf_count}
                rotation={markerRotation(find.id, i)}
              />
            </div>
          ) : null
        )}

        {/* Metadata overlay */}
        {(leafGroups.length > 0 || hasLocation) && (
          <div
            className="absolute bottom-0 left-0 flex flex-col items-start justify-end-safe gap-2 px-2 py-2 aspect-video min-w-60 font-semibold"
            style={{ background: 'linear-gradient(12.5deg, color-mix(in srgb, var(--color-background) 80%, rgba(0,0,0,0)), transparent 75%, transparent)', fontSize: ".85rem"}}
          >
            <span className="flex gap-2">
            {leafGroups.map(({ count, num }, i) => (
              <span key={i} className="flex items-center">
                <svg width="1em" height="1em" viewBox="0 0 100 100" aria-hidden="true" className="fill-current">
                  <path d={cloverPath(count)}/>
                </svg>
                {num > 1 && (
                  <span className="" >
                    ×{num}
                  </span>
                )}
              </span>
            ))}
            </span>
            {hasLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={16} strokeWidth={2} className="fill-current shrink-0" />
                {find.location_name && (
                  <span className="truncate">{find.location_name}</span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      
    </Link>
  );
}
