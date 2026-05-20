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
            className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #003311))' }}
          >
            {leafGroups.map(({ count, num }, i) => (
              <span key={i} className="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 100 100" aria-hidden="true">
                  <path d={cloverPath(count)} fill="#001831" />
                </svg>
                {num > 1 && (
                  <span className="text-xs font-semibold" style={{ color: '#001831' }}>
                    ×{num}
                  </span>
                )}
              </span>
            ))}
            {hasLocation && (
              <MapPin size={14} strokeWidth={2} style={{ color: '#001831' }} />
            )}
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="bg-surface px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text-secondary">
            {formatDate(find.found_at)}
          </span>
          {summary && (
            <span className="text-sm font-medium text-text-primary">
              {summary}
            </span>
          )}
        </div>

        {/* Location privacy badge */}
        {privacy === "approximate" && (
          <span className="shrink-0 text-xs text-text-secondary border border-border rounded px-1.5 py-0.5 mt-0.5">
            ~location
          </span>
        )}
        {privacy === "private" && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-text-secondary border border-border rounded px-1.5 py-0.5 mt-0.5">
            <Lock size={12} strokeWidth={1.5} />
            Private
          </span>
        )}
      </div>
    </Link>
  );
}
