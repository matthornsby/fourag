'use client'

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { markerRotation } from "@/lib/marker-rotation";
import { computeLuck, luckAddedOnDay, luckToOpacity, luckAddedToCircleDiameterPct, luckAddedToMarkerSize } from "@/lib/luck";
import { CloverMarker } from "@/components/clover-marker";
import type { Find, Clover } from "@/types";

interface Props {
  finds: (Find & { clovers: Clover[] })[];
  /** 0 = week starts Sunday (Sun–Sat), 1 = week starts Monday (Mon–Sun). Default: 1. */
  weekStartsOn?: 0 | 1;
  /** Currently logged-in user id; when set, photo thumbnails link to the edit page for owned finds. */
  userId?: string;
}


function dominantLeafCount(finds: (Find & { clovers: Clover[] })[], date: Date): number | null {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate()
  let max: number | null = null
  finds.forEach(f => {
    const fd = new Date(f.found_at)
    if (fd.getFullYear() === y && fd.getMonth() === m && fd.getDate() === d) {
      f.clovers.forEach(c => { if (max === null || c.leaf_count > max) max = c.leaf_count })
    }
  })
  return max
}

function MonthLabel({ date, today }: { date: Date; today: Date }) {
  const cls = 'cal-month-label-inner flex flex-col leading-tight';
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const month = date.getMonth();
  const year = date.getFullYear();
  const monthName = date.toLocaleDateString("en-US", { month: "long" });

  if (month === currentMonth && year === currentYear) {
    return (
      <div className={cls}>
        <span className="text-sm font-semibold text-text-primary">This Month</span>
        <span className="text-xs text-text-secondary">{monthName}</span>
      </div>
    );
  }

  if (month === prevMonth && year === prevYear) {
    return (
      <div className={cls}>
        <span className="text-sm font-semibold text-text-primary">Last Month</span>
        <span className="text-xs text-text-secondary">{monthName}</span>
      </div>
    );
  }

  if (year === currentYear) {
    return (
      <div className={cls}>
        <span className="text-sm font-semibold text-text-primary">{monthName}</span>
      </div>
    );
  }

  return (
    <div className={cls}>
      <span className="text-sm font-semibold text-text-primary">{monthName}</span>
      <span className="text-xs text-text-secondary">{year}</span>
    </div>
  );
}

// px a sentinel must travel above viewport top before its card is fully gone
const EXIT_DISTANCE = 120;

export function FindsCalendar({ finds, weekStartsOn = 1, userId }: Props) {
  const [exitProgress, setExitProgress] = useState<Map<string, number>>(new Map());
  const [orientations, setOrientations] = useState<Record<string, 'landscape' | 'portrait'>>({});
  const [photoSide, setPhotoSide] = useState<'left' | 'right'>('left');
  const [weekStart, setWeekStart] = useState<0 | 1>(weekStartsOn);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [colCount, setColCount] = useState(7);

  useLayoutEffect(() => {
    const update = () => setColCount(window.innerWidth < 768 ? 1 : 7);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.orientation =
      photoSide === 'left' ? 'right-handed' : 'left-handed';
  }, [photoSide]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const detectOrientation = useCallback((img: HTMLImageElement, findId: string) => {
    if (!img.naturalWidth) return;
    const orientation = img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait';
    setOrientations(prev => prev[findId] === orientation ? prev : { ...prev, [findId]: orientation });
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>, findId: string) => {
    detectOrientation(e.currentTarget, findId);
  }, [detectOrientation]);

  // Sentinel refs collected during render, observed once on mount.
  // Sentinels live in the photo column (no overflow:hidden ancestors) so
  // IntersectionObserver fires reliably in Safari.
  const pendingSentinels = useRef<Map<string, HTMLElement>>(new Map());

  const registerSentinel = useCallback((el: HTMLElement | null, findId: string) => {
    if (el) {
      pendingSentinels.current.set(findId, el);
    } else {
      pendingSentinels.current.delete(findId);
    }
  }, []);

  useEffect(() => {
    const update = () => {
      setExitProgress(prev => {
        const entries: [string, number][] = [];
        let changed = false;
        pendingSentinels.current.forEach((el, findId) => {
          const top = el.getBoundingClientRect().top;
          const progress = top >= 0 ? 0 : Math.min(1, -top / EXIT_DISTANCE);
          entries.push([findId, progress]);
          if (prev.get(findId) !== progress) changed = true;
        });
        if (!changed) return prev;
        return new Map(entries);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  if (finds.length === 0) return null;

  const today = new Date();

  const earliest = finds.reduce((min, f) =>
    new Date(f.found_at) < new Date(min.found_at) ? f : min
  );
  const earliestDate = new Date(earliest.found_at);
  const startOfFirstMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);

  const endOfCurrentWeek = new Date(today);
  endOfCurrentWeek.setDate(today.getDate() + (weekStart + 6 - today.getDay() + 7) % 7);

  const allDays: Date[] = [];
  const cursor = new Date(startOfFirstMonth);
  while (cursor <= endOfCurrentWeek) {
    allDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const leadingBlanks = colCount === 1 ? 0 : (startOfFirstMonth.getDay() - weekStart + 7) % 7;
  const cells: (Date | null)[] = [...Array(leadingBlanks).fill(null), ...allDays];
  if (colCount > 1) while (cells.length % colCount !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += colCount) weeks.push(cells.slice(i, i + colCount));
  weeks.reverse();
  const reversedCells = weeks.flat();
  const totalRows = weeks.length;

  // First occurrence of each month in reversed (newest-first) order = last chronological day of that month in the data.
  const monthLabelIndices = new Set<number>();
  {
    const seen = new Set<string>();
    reversedCells.forEach((date, i) => {
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!seen.has(key)) { seen.add(key); monthLabelIndices.add(i); }
    });
  }

  // Sort newest-first.
  const sortedFinds = [...finds].sort(
    (a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime()
  );

  // Map each find to the reversed row it falls in (0 = top/newest row).
  const msPerDay = 1000 * 60 * 60 * 24;
  const findReversedRows = sortedFinds.map(find => {
    const daysDiff = Math.round(
      (new Date(find.found_at).getTime() - startOfFirstMonth.getTime()) / msPerDay
    );
    const cellIndex = leadingBlanks + Math.max(0, daysDiff);
    const originalRow = Math.floor(cellIndex / colCount);
    return Math.max(0, Math.min(totalRows - 1, totalRows - 1 - originalRow));
  });

  // Within each row, finds are already newest-first (from sortedFinds).
  // Collect row groups to know posInRow and totalInRow per find.
  const rowGroups = new Map<number, number[]>(); // row → indices into sortedFinds
  findReversedRows.forEach((row, idx) => {
    if (!rowGroups.has(row)) rowGroups.set(row, []);
    rowGroups.get(row)!.push(idx);
  });

  // Compute the sentinel fraction (0–1 of total column height) for each find.
  // Newest find in a row → fraction = row / totalRows (fires at row top).
  // Each subsequent find in the same row → fraction increments by 1/(totalInRow*totalRows).
  const findSentinelData = sortedFinds.map((find, idx) => {
    const row = findReversedRows[idx];
    const group = rowGroups.get(row)!;
    const posInRow = group.indexOf(idx); // 0 = newest in this row
    const totalInRow = group.length;
    const fraction = (row + posInRow / totalInRow) / totalRows;
    return { find, fraction };
  });

  const TOP_N = 5;

  // Oldest-first (newest renders on top).
  const oldestFirst = [...sortedFinds].reverse();

  // Stack cards: non-fully-exited. TOP_N visible + 1 invisible buffer that fades in.
  const stackFinds = oldestFirst.filter(f => (exitProgress.get(f.id) ?? 0) < 1);
  const stackSlice = stackFinds.slice(-(TOP_N + 1));
  const stackIdxMap = new Map(stackSlice.map((f, i) => [f.id, i]));

  // Ghost cards: recently exited, kept in the render tree (same key = same <img> node)
  // so the browser doesn't unload the decoded image on re-appear.
  const ghostSlice = oldestFirst
    .filter(f => (exitProgress.get(f.id) ?? 0) >= 1)
    .slice(-TOP_N);

  // Ghosts render first (behind) so their z-index can stay 0.
  const combinedSlice = [...ghostSlice, ...stackSlice];

  return (
    <>
    <div className="flex gap-0">
      {/* Calendar grid: colCount day cols + narrow month-label col */}
      <div
        className="cal-grid grid"
        style={{
          '--cal-gap': 'clamp(2px, .5vw, 6px)',
          '--chamfer': 'calc(var(--cal-gap) * 3.2)',
          gap: 'var(--cal-gap)',
        } as React.CSSProperties}
      >
        {/* Circle pass (desktop) — rendered first so cells sit on top in DOM stacking order */}
        {colCount > 1 && reversedCells.map((date, i) => {
          if (!date) return null;
          const added = luckAddedOnDay(finds, date);
          if (added <= 0) return null;
          const diameter = luckAddedToCircleDiameterPct(added);
          const rowIndex = Math.floor(i / colCount);
          const colIndex = (i % colCount) + 1;
          return (
            <div
              key={`circle-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              className={`day-num-${colIndex} pointer-events-none`}
              style={{
                gridRowStart: rowIndex + 1,
                height: 0,
                alignSelf: 'center',
                position: 'relative',
                overflow: 'visible',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: `${diameter}%`,
                  aspectRatio: '1',
                  borderRadius: '50%',
                  background: 'var(--color-find-circle)',
                  left: '50%',
                  top: 0,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          );
        })}

        {/* Cell pass — rendered after circles, sits on top */}
        {reversedCells.map((date, i) => {
          const rowIndex = Math.floor(i / colCount);
          const colIndex = (i % colCount) + 1;

          if (!date) return (
            <div
              key={`blank-${i}`}
              className={`aspect-square day-num-${colIndex}`}
              style={{ gridRowStart: rowIndex + 1 }}
            />
          );

          const dayNum = date.getDate();
          const cellKey = `${date.getFullYear()}-${date.getMonth()}-${dayNum}`;
          const isToday = date.toDateString() === today.toDateString();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const luck = Math.round(computeLuck(finds, new Date(date.getFullYear(), date.getMonth(), dayNum, 23, 59, 59)));
          const opacity = luckToOpacity(luck);
          const added = luckAddedOnDay(finds, date);
          const leafCount = dominantLeafCount(finds, date);

          const dayCell = (
            <div
              key={cellKey}
              className={['day-cell', `day-num-${colIndex}`, isWeekend && 'weekend', isToday && 'today'].filter(Boolean).join(' ')}
              style={{
                gridRowStart: rowIndex + 1,
                '--day-bg': `color-mix(in srgb, var(--color-accent) ${opacity * 100 * .75}%, var(--color-surface))`,
              } as React.CSSProperties}
            >
              {/* Clover marker */}
              {leafCount !== null && added > 0 && (
                <div
                  className="pointer-events-none"
                  style={{
                    position: 'absolute',
                    width: `${luckAddedToMarkerSize(added) * 100}%`,
                    aspectRatio: '1',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <CloverMarker leafCount={leafCount} rotation={markerRotation(cellKey, 0)} filled />
                </div>
              )}

              {/* Mobile circle — inside cell so it auto-places correctly with its row */}
              {colCount === 1 && added > 0 && (
                <div
                  className="pointer-events-none"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${luckAddedToCircleDiameterPct(added)}%`,
                    aspectRatio: '1',
                    borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--color-find-circle) 50%, transparent)',
                  }}
                />
              )}

              <span className={['day-cell-label', (isToday || dayNum === 1) && 'notable'].filter(Boolean).join(' ')}>
                {dayNum === 1
                  ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()]} 1`
                  : dayNum}
              </span>
            </div>
          );

          if (!monthLabelIndices.has(i)) return dayCell;

          return (
            <React.Fragment key={cellKey}>
              <div
                className="cal-month-label"
                style={{ '--cal-month-row': rowIndex + 1 } as React.CSSProperties}
              >
                <MonthLabel date={date} today={today} />
              </div>
              {dayCell}
            </React.Fragment>
          );
        })}
      </div>

      {/*
        Photo column. Contains:
        1. Zero-height sentinel divs at computed fractional positions.
           Sentinels have no overflow:hidden ancestors, so IntersectionObserver
           fires correctly in Safari.
        2. A single sticky photo stack that shows only the finds whose sentinels
           haven't yet exited the top of the viewport.

        Sentinel fraction math (7-column layout):
          fraction = (reversedRow + posInRow / totalInRow) / totalRows
          - reversedRow 0 = top/newest row
          - posInRow 0 = newest find in that row (exits first)
        When colCount changes (future mobile layout), swap reversedRow to use
        per-day rows instead of per-week rows.
      */}
      <div className="cal-photo-col relative">
        {findSentinelData.map(({ find, fraction }) => (
          <div
            key={`sentinel-${find.id}`}
            ref={el => registerSentinel(el as HTMLElement | null, find.id)}
            data-find-id={find.id}
            className="absolute inset-x-0 h-0 pointer-events-none"
            style={{ top: `${fraction * 100}%` }}
          />
        ))}

        <div className="sticky top-0 h-screen flex items-center py-4">
          {/* Square container: portrait fills height (3/4 wide), landscape fills width (3/4 tall) — equal area, no crop */}
          <div className="relative w-full aspect-square shrink-0">
            {combinedSlice.map((find) => {
              const exitProg = exitProgress.get(find.id) ?? 0;
              const isGhost = exitProg >= 1;
              const isLandscape = (orientations[find.id] ?? 'portrait') === 'landscape';
              const rotation = markerRotation(find.id, 0) * 0.5;
              const offsetX = markerRotation(find.id, 1) * 0.4;
              const offsetY = markerRotation(find.id, 2) * 0.4;
              const exitX = markerRotation(find.id, 3) * 20;
              const exitY = -(150 + Math.abs(markerRotation(find.id, 4)) * 8);
              const exitRot = markerRotation(find.id, 5) * 2;
              const baseTransform = isLandscape
                ? `translateY(-50%) rotate(${rotation + exitProg * exitRot}deg) translate(${offsetX + exitProg * exitX}px, ${offsetY + exitProg * exitY}px)`
                : `translateX(-50%) rotate(${rotation + exitProg * exitRot}deg) translate(${offsetX + exitProg * exitX}px, ${offsetY + exitProg * exitY}px)`;

              if (isGhost) {
                return (
                  <div
                    key={find.id}
                    className={`absolute overflow-hidden rounded-xl pointer-events-none ${
                      isLandscape ? 'inset-x-0 top-1/2 aspect-[4/3]' : 'inset-y-0 left-1/2 aspect-[3/4]'
                    }`}
                    style={{ zIndex: 0, opacity: 0, transform: baseTransform }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={find.photo_url} alt="" className="w-full h-full object-cover block" />
                  </div>
                );
              }

              const stackIdx = stackIdxMap.get(find.id) ?? 0;
              const posFromTop = stackSlice.length - 1 - stackIdx;
              const isTop = posFromTop === 0;
              // Opacity only starts dropping in the final 30% of the exit movement.
              const FADE_START = 0.85;
              const opacity = posFromTop >= TOP_N ? 0 : Math.max(0, 1 - Math.max(0, exitProg - FADE_START) / (1 - FADE_START));
              const transition = exitProg === 0 ? 'opacity 400ms ease' : undefined;

              const cardClass = `absolute overflow-hidden rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${
                isLandscape ? 'inset-x-0 top-1/2 aspect-[4/3]' : 'inset-y-0 left-1/2 aspect-[3/4]'
              }`;
              const cardStyle = { zIndex: stackIdx + 1, opacity, transition, transform: baseTransform };
              const cardInner = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={find.photo_url}
                    alt=""
                    loading="lazy"
                    onLoad={e => handleImageLoad(e, find.id)}
                    ref={el => { if (el?.complete && el.naturalWidth > 0) detectOrientation(el, find.id); }}
                    className="w-full h-full object-cover block"
                  />
                  <div className="absolute bottom-0 left-0 flex flex-col items-start justify-end-safe gap-2 px-2 py-2 aspect-video min-w-60 font-semibold text-xs"
                    style={{ background: 'linear-gradient(12.5deg, color-mix(in srgb, var(--color-background) 90%, rgba(0,0,0,.5)), transparent 75%, transparent)'}}>
                    <span className={[
                        'truncate flex gap-1 transition-opacity duration-300',
                        isTop && find.location_name ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}>
                      <MapPin size={12} strokeWidth={2} className="shrink-0" />{find.location_name}
                    </span>
                  </div>
                </>
              );

              return userId === find.user_id ? (
                <Link key={find.id} href={`/account/finds/${find.id}/edit`} className={cardClass} style={cardStyle}>
                  {cardInner}
                </Link>
              ) : (
                <div key={find.id} className={cardClass} style={cardStyle}>
                  {cardInner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    {/* Temporary controls palette */}
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-2xl shadow-xl text-xs font-medium"
      style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in srgb, var(--color-text-primary) 12%, transparent)' }}>
      <button onClick={() => setPhotoSide('left')}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: photoSide === 'left' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Right-handed
      </button>
      <button onClick={() => setPhotoSide('right')}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: photoSide === 'right' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Left-handed
      </button>
      <div className="w-px h-4 mx-1" style={{ background: 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' }} />
      <button onClick={() => setTheme('dark')}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: theme === 'dark' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Dark
      </button>
      <button onClick={() => setTheme('light')}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: theme === 'light' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Light
      </button>
      <div className="w-px h-4 mx-1" style={{ background: 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' }} />
      <button onClick={() => setWeekStart(1)}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: weekStart === 1 ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Mon
      </button>
      <button onClick={() => setWeekStart(0)}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: weekStart === 0 ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Sun
      </button>
    </div>
    </>
  );
}


