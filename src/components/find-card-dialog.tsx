'use client'

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Pencil } from "lucide-react";
import { XCloseIcon } from "@/components/icons/x-close";
import { CloverMarker } from "@/components/clover-marker";
import { FindMap } from "@/components/find-map";
import { markerRotation } from "@/lib/marker-rotation";
import { cloverPath } from "@/lib/clover-path";
import { luckValue, LUCK_DECAY_RATE } from "@/lib/luck";
import type { Find, Clover } from "@/types";

interface Props {
  find: (Find & { clovers: Clover[] }) | null;
  userId?: string;
  username?: string;
  onClose: () => void;
  sourceRect?: DOMRect | null;
  getTargetRect?: () => DOMRect | null;
  imperativeCloseRef?: React.MutableRefObject<(() => void) | null>;
  adminControls?: React.ReactNode;
}

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


const ANIM_MS = 320;
const EASING = 'cubic-bezier(0.32,0.72,0,1)';

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

export function FindCardDialog({ find, userId, username, onClose, sourceRect, getTargetRect, imperativeCloseRef, adminControls }: Props) {
  const [currentFind, setCurrentFind] = useState(find);
  const [theme, setTheme] = useState<string | undefined>(undefined);
  const [photoRatios, setPhotoRatios] = useState<{ natural: number; container: number } | null>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme);
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const openScaleRef = useRef(0.5);

  useEffect(() => {
    if (find) { setCurrentFind(find); setPhotoRatios(null); }
  }, [find]);

  function handlePhotoLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.clientWidth > 0 && img.clientHeight > 0) {
      setPhotoRatios({
        natural: img.naturalWidth / img.naturalHeight,
        container: img.clientWidth / img.clientHeight,
      });
    }
  }

  // FLIP open
  useLayoutEffect(() => {
    if (!currentFind || !sourceRect || !cardRef.current) return;
    const el = cardRef.current;
    const r = el.getBoundingClientRect();
    if (!r.width) return;

    const dx = (sourceRect.left + sourceRect.width / 2) - (r.left + r.width / 2);
    const dy = (sourceRect.top + sourceRect.height / 2) - (r.top + r.height / 2);
    const s = Math.min(sourceRect.width / r.width, 0.6);
    openScaleRef.current = s;

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px,${dy}px) scale(${s})`;
    el.getBoundingClientRect();
    el.style.transition = `transform ${ANIM_MS}ms ${EASING}`;
    el.style.transform = '';
  }, [currentFind, sourceRect]);

  useEffect(() => {
    document.body.style.overflow = currentFind ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [currentFind]);

  useEffect(() => {
    if (imperativeCloseRef) imperativeCloseRef.current = currentFind ? triggerClose : null;
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentFind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') triggerClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerClose = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const cardEl = cardRef.current;
    const bdEl = backdropRef.current;
    const target = getTargetRect?.();

    onClose();

    if (cardEl && target) {
      const r = cardEl.getBoundingClientRect();
      const dx = (target.left + target.width / 2) - (r.left + r.width / 2);
      const dy = (target.top + target.height / 2) - (r.top + r.height / 2);
      const s = openScaleRef.current;
      const rot = markerRotation(currentFind!.id, 0) * 0.5;

      cardEl.style.transition = `transform ${ANIM_MS}ms ${EASING}, opacity ${Math.round(ANIM_MS * 0.5)}ms ease ${Math.round(ANIM_MS * 0.5)}ms`;
      cardEl.style.transform = `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${s})`;
      cardEl.style.opacity = '0';
    } else if (cardEl) {
      cardEl.style.transition = `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`;
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.92)';
    }

    if (bdEl) {
      bdEl.style.transition = `opacity ${ANIM_MS}ms ease`;
      bdEl.style.opacity = '0';
    }

    setTimeout(() => {
      setCurrentFind(null);
      animatingRef.current = false;
    }, ANIM_MS);
  };

  if (!currentFind) return null;

  const leafGroups = groupLeafCounts(currentFind.clovers);
  const hasLocation = currentFind.lat !== null && currentFind.lng !== null && currentFind.location_privacy !== 'private';
  const isOwner = userId === currentFind.user_id;
  const isLandscape = photoRatios ? photoRatios.natural > 1 : false;

  const subject = isOwner ? 'You' : (username ?? null);
  const locationClause = currentFind.location_name && currentFind.location_privacy !== 'private'
    ? ` in ${currentFind.location_name.split(',').slice(0, 2).join(',').trim()}`
    : '';
  const findNarrative = currentFind.clovers.length > 0
    ? `${subject ? subject + ' found' : 'Found'} ${cloverDescription(currentFind.clovers)}${locationClause} on the ${timeOfDay(currentFind.found_at)} of ${formatNarrativeDate(currentFind.found_at)}.`
    : null;
  const luckLine = luckNarrative(currentFind);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{
          background: 'color-mix(in srgb, var(--color-background) 92%, transparent)',
          animation: `find-backdrop-in ${ANIM_MS}ms ease`,
        }}
        onClick={triggerClose}
      />

      {/* Card */}
      <div
        ref={cardRef}
        className={`find-card ${isLandscape ? 'landscape' : 'portrait'} relative z-10 rounded-xl shadow-2xl`}
      >
        {/* Inner wrapper clips image corners and markers without clipping the close button */}
        <div className="find-card-inner rounded-3xl overflow-hidden">
        {isLandscape ? (
          /* Landscape layout: photo full-width on top, text + map in two columns below */
          <div className="grid grid-cols-1">
            {/* Photo row */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={photoImgRef}
                src={currentFind.photo_url}
                alt=""
                className="w-full block"
                onLoad={handlePhotoLoad}
              />

              {currentFind.clovers.map((clover, i) => {
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
                      rotation={clover.annotation_rotation ?? markerRotation(currentFind.id, i)}
                    />
                  </div>
                );
              })}

              {leafGroups.length > 0 && (
                <div className="find-card-leaf-label absolute bottom-0 left-0 px-3 py-3 font-semibold">
                  <span className="flex gap-2">
                    {leafGroups.map(({ count, num }, i) => (
                      <span key={i} className="flex items-center gap-0.5">
                        <svg width="1.1em" height="1.1em" viewBox="0 0 100 100" aria-hidden="true" className="fill-current">
                          <path d={cloverPath(count)} />
                        </svg>
                        {num > 1 && <span>×{num}</span>}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Text + map row */}
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {/* Notes / narrative */}
              <div className="flex flex-col gap-3 px-5 py-5">
                {currentFind.notes && (
                  <p className="text-base font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                    {currentFind.notes}
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
                    href={`/account/finds/${currentFind.id}/edit`}
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
              <div className="find-card-map relative overflow-hidden">
                {hasLocation && currentFind.lat !== null && currentFind.lng !== null ? (
                  <>
                    <FindMap lat={currentFind.lat} lng={currentFind.lng} leafCount={currentFind.clovers.reduce((m, c) => Math.max(m, c.leaf_count), 4)} findId={currentFind.id} theme={theme} />
                    {currentFind.location_name && (
                      <div className="find-card-location-pill absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium">
                        <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                        <span className="truncate">{currentFind.location_name}</span>
                      </div>
                    )}
                  </>
                ) : hasLocation && currentFind.location_name ? (
                  <div className="flex items-center gap-1.5 px-5 py-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                    <span>{currentFind.location_name}</span>
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
                src={currentFind.photo_url}
                alt=""
                className="w-full h-full object-cover block"
                onLoad={handlePhotoLoad}
              />

              {currentFind.clovers.map((clover, i) => {
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
                      rotation={clover.annotation_rotation ?? markerRotation(currentFind.id, i)}
                    />
                  </div>
                );
              })}

              {leafGroups.length > 0 && (
                <div className="find-card-leaf-label absolute bottom-0 left-0 px-3 py-3 font-semibold">
                  <span className="flex gap-2">
                    {leafGroups.map(({ count, num }, i) => (
                      <span key={i} className="flex items-center gap-0.5">
                        <svg width="1.1em" height="1.1em" viewBox="0 0 100 100" aria-hidden="true" className="fill-current">
                          <path d={cloverPath(count)} />
                        </svg>
                        {num > 1 && <span>×{num}</span>}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Notes / narrative column */}
            <div className="find-card-notes flex flex-col gap-3 px-5 py-5">
              {currentFind.notes && (
                <p className="text-base font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                  {currentFind.notes}
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
                  href={`/account/finds/${currentFind.id}/edit`}
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
            <div className="find-card-map relative overflow-hidden">
              {hasLocation && currentFind.lat !== null && currentFind.lng !== null ? (
                <>
                  <FindMap lat={currentFind.lat} lng={currentFind.lng} leafCount={currentFind.clovers.reduce((m, c) => Math.max(m, c.leaf_count), 4)} findId={currentFind.id} theme={theme} />
                  {currentFind.location_name && (
                    <div className="find-card-location-pill absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium">
                      <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                      <span className="truncate">{currentFind.location_name}</span>
                    </div>
                  )}
                </>
              ) : hasLocation && currentFind.location_name ? (
                <div className="flex items-center gap-1.5 px-5 py-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <MapPin size={13} strokeWidth={2} className="fill-current shrink-0" />
                  <span>{currentFind.location_name}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        </div>{/* end inner clipping wrapper */}

        {/* Close button — outside the clipping wrapper so it breaks out of the card corner */}
        <XCloseIcon
          onClick={triggerClose}
          size={32}
          strokeWidth={2.08}
          stroke="var(--color-close)"
          fill="color-mix(in srgb, var(--color-close) 25%, var(--color-background) 75%)"
          className="absolute -top-2 -right-2 hover:opacity-80 transition-opacity cursor-pointer drop-shadow-2xl"
          aria-label="Close"
        />
      </div>
    </div>
  );
}
