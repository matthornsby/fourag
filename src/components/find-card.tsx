import Link from "next/link";
import { Lock } from "lucide-react";
import type { Find, Clover } from "@/types";

interface FindCardProps {
  find: Find & { clovers: Clover[] };
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

  return (
    <Link
      href={`/finds/${find.id}`}
      className="block border border-border rounded-lg overflow-hidden hover:border-accent transition-colors duration-150"
    >
      {/* Photo */}
      <div className="bg-background flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={find.photo_url}
          alt={summary || "Clover find"}
          className="max-h-[60vh] w-auto object-contain"
        />
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
