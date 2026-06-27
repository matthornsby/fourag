'use client'

import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Pencil } from "lucide-react";
import { CloverMarker } from "@/components/clover-marker";
import { FindMap } from "@/components/find-map";
import { markerRotation } from "@/lib/marker-rotation";
import { prettify } from "@/lib/prettify";
import { luckValue, LUCK_DECAY_RATE } from "@/lib/luck";
import type { Find, Clover } from "@/types";

function groupLeafCounts(clovers: Clover[]): { count: number; num: number }[] {
  const freq = new Map<number, number>();
  for (const c of clovers) freq.set(c.leaf_count, (freq.get(c.leaf_count) ?? 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([count, num]) => ({ count, num }));
}

const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numWord(n: number): string {
  return n < ONES.length ? ONES[n] : String(n);
}

const LEAF_NAMES: Record<number, string> = {
  3: 'three-leaf', 4: 'four-leaf', 5: 'five-leaf', 6: 'six-leaf', 7: 'seven-leaf',
};
function leafName(count: number): string {
  return LEAF_NAMES[count] ?? `${count}-leaf`;
}

function cloverDescription(clovers: Clover[]): string {
  const groups = groupLeafCounts(clovers);
  const parts = groups.map(({ count, num }) => {
    const word = numWord(num);
    const name = leafName(count);
    return `${num === 1 ? 'a' : word} ${name} ${num === 1 ? 'clover' : 'clovers'}`;
  });
  if (parts.length === 0) return 'a clover';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

function timeOfDay(dateString: string): string {
  const hour = new Date(dateString).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function formatNarrativeDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(dateString));
}

function luckNarrative(find: Find & { clovers: Clover[] }): string {
  const totalLuck = find.clovers.reduce((sum, c) => sum + luckValue(c.leaf_count), 0);
  if (totalLuck <= 0) return '';
  // Luck drops to 0 at t = totalLuck / LUCK_DECAY_RATE
  const daysOfLuck = Math.round(totalLuck / LUCK_DECAY_RATE);
  const expiryDate = new Date(find.found_at);
  expiryDate.setDate(expiryDate.getDate() + daysOfLuck);
  const now = new Date();
  const expired = expiryDate < now;
  const expiryStr = formatNarrativeDate(expiryDate.toISOString());
  const pronoun = find.clovers.length === 1 ? 'It' : 'They';
  if (expired) {
    return `${pronoun} added ${daysOfLuck} days of luck, but it ran out on ${expiryStr}.`;
  }
  return `${pronoun} added ${daysOfLuck} days of luck, lasting until ${expiryStr}.`;
}

// Convert annotation coords (fraction of image) → fraction of container for object-cover display.
function coverCoords(ax: number, ay: number, naturalRatio: number, containerRatio: number) {
  if (naturalRatio >= containerRatio) {
    // Landscape image relative to container: overflows horizontally, center-cropped.
    const scale = naturalRatio / containerRatio;
    return { cx: (ax - 0.5) * scale + 0.5, cy: ay };
  } else {
    // Portrait image relative to container: overflows vertically, center-cropped.
    const scale = containerRatio / naturalRatio;
    return { cx: ax, cy: (ay - 0.5) * scale + 0.5 };
  }
}

// Radius stored as fraction of rendered image width; convert to fraction of container width.
function coverRadius(r: number, naturalRatio: number, containerRatio: number) {
  return naturalRatio >= containerRatio ? r * naturalRatio / containerRatio : r;
}

interface Props {
  find: Find & { clovers: Clover[] };
  userId?: string;
  username?: string;
  /** Only the active (centered) card mounts its map — maplibre GL contexts are expensive. */
  isActive: boolean;
  /** Known orientation (from the calendar) so the correct layout renders on the first
   * frame — avoids a portrait→landscape layout swap (and vertical shift) once the image loads. */
  initialOrientation?: 'landscape' | 'portrait';
  theme?: string;
  adminControls?: React.ReactNode;
}

/**
 * Presentational find card. Renders the rounded `.find-card` element (without the close
 * button, which the carousel owns). Forwards a ref to the root so the carousel can drive
 * its transform for FLIP open/close.
 */
export const FindCardContent = forwardRef<HTMLDivElement, Props>(function FindCardContent(
  { find, userId, username, isActive, initialOrientation, theme, adminControls },
  ref,
) {
  const [photoRatios, setPhotoRatios] = useState<{ natural: number; container: number } | null>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => { setPhotoRatios(null); }, [find.id]);

  function handlePhotoLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.clientWidth > 0 && img.clientHeight > 0) {
      setPhotoRatios({
        natural: img.naturalWidth / img.naturalHeight,
        container: img.clientWidth / img.clientHeight,
      });
    }
  }

  const hasLocation = find.lat !== null && find.lng !== null && find.location_privacy !== 'private';
  // A map will be shown (mounts only when active) — reserve its height up front so the
  // card doesn't grow (and shift) when the map mounts on settle.
  const hasMapView = hasLocation && find.lat !== null && find.lng !== null;
  const isOwner = userId === find.user_id;
  // Prefer the measured ratio; before the image loads fall back to the orientation the
  // calendar already knows, so the layout doesn't swap (and shift) on load.
  const isLandscape = photoRatios ? photoRatios.natural > 1 : initialOrientation === 'landscape';

  const subject = isOwner ? 'You' : (username ?? null);
  const locationClause = find.location_name && find.location_privacy !== 'private'
    ? ` in ${find.location_name.split(',').slice(0, 2).join(',').trim()}`
    : '';
  const findNarrative = find.clovers.length > 0
    ? `${subject ? subject + ' found' : 'Found'} ${cloverDescription(find.clovers)}${locationClause} on the ${timeOfDay(find.found_at)} of ${formatNarrativeDate(find.found_at)}.`
    : null;
  const luckLine = luckNarrative(find);

  return (
    <div
      ref={ref}
      className={`find-card ${isLandscape ? 'landscape' : 'portrait'} relative rounded-xl shadow-2xl`}
    >
      {/* Inner wrapper clips image corners and markers */}
      <div className="find-card-inner relative rounded-3xl overflow-hidden">
        {isLandscape ? (
          /* Landscape layout: photo full-width on top, text + map in two columns below */
          <div className="grid grid-cols-1">
            {/* Photo row */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={photoImgRef}
                src={find.photo_url}
                alt=""
                className="w-full block"
                onLoad={handlePhotoLoad}
              />

              {find.clovers.map((clover, i) => {
                if (clover.annotation_x === null || clover.annotation_y === null) return null;
                const radius = clover.annotation_radius ?? 0.09;
                return (
                  <div
                    key={clover.id}
                    className="absolute select-none pointer-events-none"
                    style={{
                      left: `${clover.annotation_x * 100}%`,
                      top: `${clover.annotation_y * 100}%`,
                      width: `${radius * 200}%`,
                      aspectRatio: '1',
                      filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <CloverMarker
                      leafCount={clover.leaf_count}
                      rotation={clover.annotation_rotation ?? markerRotation(find.id, i)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Text + map row */}
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {/* Notes / narrative */}
              <div className="flex flex-col gap-3 px-5 py-5">
                {find.notes && (
                  <p className="text-base font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                    {prettify(find.notes)}
                  </p>
                )}
                {findNarrative && (
                  <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {findNarrative}
                  </p>
                )}
                {luckLine && (
                  <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {luckLine}
                  </p>
                )}
                {isOwner && (
                  <Link
                    href={`/account/finds/${find.id}/edit`}
                    className="flex items-center gap-1.5 text-sm font-medium self-start hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    <Pencil size={13} strokeWidth={2.5} />
                    Edit
                  </Link>
                )}
                {adminControls}
              </div>

              {/* Map / location */}
              <div className="find-card-map relative overflow-hidden" style={hasMapView ? { minHeight: '10rem' } : undefined}>
                {hasLocation && find.lat !== null && find.lng !== null ? (
                  <>
                    {isActive && (
                      <FindMap lat={find.lat} lng={find.lng} leafCount={find.clovers.reduce((m, c) => Math.max(m, c.leaf_count), 4)} findId={find.id} theme={theme} isApproximate={find.location_privacy === 'approximate'} />
                    )}
                    {find.location_name && (
                      <div className="find-card-location-pill absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium">
                        <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                        <span className="truncate">{find.location_name}</span>
                      </div>
                    )}
                  </>
                ) : hasLocation && find.location_name ? (
                  <div className="flex items-center gap-1.5 px-5 py-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                    <span>{find.location_name}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          /* Portrait layout: photo left (right-handed) or right (left-handed), text + map stacked on other side */
          <div className="find-card-portrait grid grid-cols-1 sm:grid-cols-2">

            {/* Photo column — spans both rows on sm+ */}
            <div className="find-card-photo relative sm:row-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={photoImgRef}
                src={find.photo_url}
                alt=""
                className="w-full h-full object-cover block"
                onLoad={handlePhotoLoad}
              />

              {find.clovers.map((clover, i) => {
                if (clover.annotation_x === null || clover.annotation_y === null) return null;
                const rawRadius = clover.annotation_radius ?? 0.09;
                const { cx, cy, radius } = photoRatios
                  ? {
                      ...coverCoords(clover.annotation_x, clover.annotation_y, photoRatios.natural, photoRatios.container),
                      radius: coverRadius(rawRadius, photoRatios.natural, photoRatios.container),
                    }
                  : { cx: clover.annotation_x, cy: clover.annotation_y, radius: rawRadius };
                return (
                  <div
                    key={clover.id}
                    className="absolute select-none pointer-events-none"
                    style={{
                      left: `${cx * 100}%`,
                      top: `${cy * 100}%`,
                      width: `${radius * 200}%`,
                      aspectRatio: '1',
                      filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <CloverMarker
                      leafCount={clover.leaf_count}
                      rotation={clover.annotation_rotation ?? markerRotation(find.id, i)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Notes / narrative column */}
            <div className="find-card-notes flex flex-col gap-3 px-5 py-5">
              {find.notes && (
                <p className="text-base font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                  {prettify(find.notes)}
                </p>
              )}

              {findNarrative && (
                <p className="text-base " style={{ color: 'var(--color-text-secondary)' }}>
                  {findNarrative}
                </p>
              )}

              {luckLine && (
                <p className="text-base " style={{ color: 'var(--color-text-secondary)' }}>
                  {luckLine}
                </p>
              )}

              {isOwner && (
                <Link
                  href={`/account/finds/${find.id}/edit`}
                  className="flex items-center gap-1.5 text-sm font-medium self-start hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <Pencil size={13} strokeWidth={2.5} />
                  Edit
                </Link>
              )}

              {adminControls}
            </div>

            {/* Map / location column */}
            <div className="find-card-map relative overflow-hidden" style={hasMapView ? { minHeight: '10rem' } : undefined}>
              {hasLocation && find.lat !== null && find.lng !== null ? (
                <>
                  {isActive && (
                    <FindMap lat={find.lat} lng={find.lng} leafCount={find.clovers.reduce((m, c) => Math.max(m, c.leaf_count), 4)} findId={find.id} theme={theme} isApproximate={find.location_privacy === 'approximate'} />
                  )}
                  {find.location_name && (
                    <div className="find-card-location-pill absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium">
                      <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                      <span className="truncate">{find.location_name}</span>
                    </div>
                  )}
                </>
              ) : hasLocation && find.location_name ? (
                <div className="flex items-center gap-1.5 px-5 py-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                  <span>{find.location_name}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
        {/* Dim scrim for off-centre cards (opacity driven by the slide's --ar). */}
        <div className="find-card-scrim" aria-hidden="true" />
      </div>{/* end inner clipping wrapper */}
    </div>
  );
});
