'use client'

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { MapPin } from "lucide-react";
import { markerRotation } from "@/lib/marker-rotation";
import { computeLuck, luckAddedOnDay, luckToOpacity, luckAddedToCircleDiameterPct, luckAddedToMarkerSize } from "@/lib/luck";
import { CloverMarker } from "@/components/clover-marker";
import { FindCardDialog } from "@/components/find-card-dialog";
import { loadPrefs, savePrefs } from "@/lib/prefs";
import { SHOW_EMPTY_MONTHS } from "@/lib/constants";
import type { Find, Clover } from "@/types";

// --- Meta helpers ---
const LEAF_NAMES: Record<number, string> = {
  3: 'three-leaf', 4: 'four-leaf', 5: 'five-leaf', 6: 'six-leaf', 7: 'seven-leaf',
};
const NUM_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numWord(n: number) { return n < NUM_WORDS.length ? NUM_WORDS[n] : String(n); }
function leafName(n: number) { return LEAF_NAMES[n] ?? `${n}-leaf`; }
function cloverTitle(clovers: Clover[]): string {
  const freq = new Map<number, number>();
  for (const c of clovers) freq.set(c.leaf_count, (freq.get(c.leaf_count) ?? 0) + 1);
  const groups = Array.from(freq.entries()).sort((a, b) => b[0] - a[0]);
  const parts = groups.map(([count, num]) =>
    `${num === 1 ? 'a' : numWord(num)} ${leafName(count)} ${num === 1 ? 'clover' : 'clovers'}`
  );
  if (!parts.length) return 'a clover';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}
function findTimeOfDay(dateStr: string) {
  const h = new Date(dateStr).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}
function findFormatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(dateStr));
}

// A vertical sine wave as a quadratic-bezier path — oscillates in x as it runs
// down y. Drawn one wavelength past each end so it can translate by ±one
// wavelength and still fill seamlessly: the wave flows along the line in place,
// without shifting the line's position.
function sineWavePath(yStart: number, yEnd: number, wavelength: number, amp: number, mid: number): string {
  const half = wavelength / 2;
  let d = `M ${mid} ${yStart}`;
  let dir = -1;
  for (let y = yStart; y < yEnd; y += half) {
    d += ` Q ${mid + dir * amp * 2} ${y + half / 2} ${mid} ${y + half}`;
    dir *= -1;
  }
  return d;
}
// viewBox 0 0 12 48 → 2 wavelengths visible; drawn from -24 to 72 for the scroll loop.
const REVEAL_WAVE_PATH = sineWavePath(-24, 72, 24, 2.5, 6);

// "Sep 2024 – Mar 2026" (or a single "Mar 2025" when the gap is within one month).
function formatHiddenRange(min: Date, max: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const a = fmt(min), b = fmt(max);
  return a === b ? a : `${a} – ${b}`;
}

function getMeta(attr: string, value: string): string {
  return (document.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null)?.content ?? '';
}
function setMeta(attr: string, value: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null;
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, value); document.head.appendChild(el); }
  el.content = content;
}

interface PageMeta { title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; }
function capturePageMeta(): PageMeta {
  return {
    title: document.title,
    description: getMeta('name', 'description'),
    ogTitle: getMeta('property', 'og:title'),
    ogDescription: getMeta('property', 'og:description'),
    ogImage: getMeta('property', 'og:image'),
  };
}
function applyPageMeta(meta: PageMeta) {
  document.title = meta.title;
  if (meta.description) setMeta('name', 'description', meta.description);
  if (meta.ogTitle) setMeta('property', 'og:title', meta.ogTitle);
  if (meta.ogDescription) setMeta('property', 'og:description', meta.ogDescription);
  if (meta.ogImage) setMeta('property', 'og:image', meta.ogImage);
}

interface Props {
  finds: (Find & { clovers: Clover[] })[];
  /** 0 = week starts Sunday (Sun–Sat), 1 = week starts Monday (Mon–Sun). Default: 1. */
  weekStartsOn?: 0 | 1;
  /** Currently logged-in user id; when set, photo thumbnails link to the edit page for owned finds. */
  userId?: string;
  /** Username of the profile being viewed, for display in find narratives. */
  username?: string;
  /** Open this find's dialog immediately on mount (e.g. when navigating directly to /finds/:id). */
  initialFindId?: string;
  /**
   * URL prefix for find deep-links. Default "" → /finds/{id}.
   * On a user profile page pass e.g. "/matt" → /matt/finds/{id}.
   */
  basePath?: string;
  /** Optional content rendered above the photo stack in the photo column. */
  header?: React.ReactNode;
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

export function FindsCalendar({ finds, weekStartsOn = 1, userId, username, initialFindId, basePath = '', header }: Props) {
  const [exitProgress, setExitProgress] = useState<Map<string, number>>(new Map());
  const [orientations, setOrientations] = useState<Record<string, 'landscape' | 'portrait'>>({});
  const [photoSide, setPhotoSide] = useState<'left' | 'right'>('left');
  const [weekStart, setWeekStart] = useState<0 | 1>(weekStartsOn);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const skipOrientationFirst = useRef(true);
  const skipThemeFirst = useRef(true);
  const [evenSentinels, setEvenSentinels] = useState(true);
  const [colCount, setColCount] = useState(7);
  // When false (default), months with no finds are collapsed behind a reveal button.
  // Set of period ids (each period's top original row) that the user has revealed.
  const [revealedPeriods, setRevealedPeriods] = useState<Set<number>>(new Set());
  const [selectedFind, setSelectedFind] = useState<(Find & { clovers: Clover[] }) | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);
  const dialogCloseRef = useRef<(() => void) | null>(null);
  const origMetaRef = useRef<PageMeta | null>(null);

  // Capture page meta once on mount so it can be restored when a modal closes.
  useEffect(() => { origMetaRef.current = capturePageMeta(); }, []);

  // Measure actual row height (cell + gap) from the rendered grid for pixel-perfect label alignment.
  const [cellHeightPx, setCellHeightPx] = useState(0);
  const [rowGapPx, setRowGapPx] = useState(0);
  const [dowRowHeightPx, setDowRowHeightPx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const dowProbeRef = useRef<HTMLDivElement>(null);

  const [viewportH, setViewportH] = useState(0);

  useLayoutEffect(() => {
    const update = () => {
      setColCount(window.innerWidth < 768 ? 1 : 7);
      setViewportH(window.innerHeight);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Derive exact cell height, row gap, and day-of-week row height from the live grid.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const probe = probeRef.current;
    if (!grid || !probe) return;
    const measure = () => {
      const cellH = probe.getBoundingClientRect().height;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      setCellHeightPx(cellH);
      setRowGapPx(gap);
      const dowEl = dowProbeRef.current;
      if (dowEl) setDowRowHeightPx(dowEl.getBoundingClientRect().height);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);

  // The server already applies saved theme/orientation to <html> before paint
  // (from the prefs cookie). Load them into local state so the controls reflect
  // reality and we don't clobber the server value on mount.
  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.orientation === 'left-handed') setPhotoSide('right');
    if (prefs.theme === 'light') setTheme('light');
    if (prefs.weekStart !== undefined) setWeekStart(prefs.weekStart);
  }, []);

  useEffect(() => {
    if (skipOrientationFirst.current) { skipOrientationFirst.current = false; return; }
    const orientation = photoSide === 'left' ? 'right-handed' : 'left-handed';
    document.documentElement.dataset.orientation = orientation;
    savePrefs({ orientation });
  }, [photoSide]);

  useEffect(() => {
    if (skipThemeFirst.current) { skipThemeFirst.current = false; return; }
    document.documentElement.dataset.theme = theme;
    savePrefs({ theme });
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

  // Open dialog from URL on mount (direct link or initial URL).
  useEffect(() => {
    const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = window.location.pathname.match(new RegExp(`^${escapedBase}/find/(.+)$`));
    const id = initialFindId ?? match?.[1];
    if (!id) return;
    const find = finds.find(f => f.id === id);
    if (find) setSelectedFind(find);
    // No FLIP animation on mount — no source card to animate from.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dialog when browser back is pressed (browser already changed the URL).
  useEffect(() => {
    const onPopstate = () => { dialogCloseRef.current?.(); };
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);

  const findUrl = useCallback((find: Find & { clovers: Clover[] }) => {
    const slug = find.users?.username ?? basePath.replace(/^\//, '');
    return slug ? `/${slug.toLowerCase()}/find/${find.id}` : `${basePath}/find/${find.id}`;
  }, [basePath]);

  const applyFindMeta = useCallback((find: Find & { clovers: Clover[] }) => {
    const slug = find.users?.username ?? basePath.replace(/^\//, '');
    const displayName = !slug || slug === 'anonymous' ? 'Someone' : slug.charAt(0).toUpperCase() + slug.slice(1);
    const titleText = `${displayName ? displayName + ' found ' : 'Found '}${cloverTitle(find.clovers)} ✤ Fourag`;
    const tod = findTimeOfDay(find.found_at);
    const date = findFormatDate(find.found_at);
    const descText = find.location_name
      ? `The ${tod} of ${date} in ${find.location_name}.`
      : `The ${tod} of ${date}.`;
    document.title = titleText;
    setMeta('name', 'description', descText);
    setMeta('property', 'og:title', titleText);
    setMeta('property', 'og:description', descText);
    if (find.photo_url) setMeta('property', 'og:image', find.photo_url);
  }, [basePath]);

  const openFind = useCallback((find: Find & { clovers: Clover[] }, el: HTMLElement) => {
    activeCardRef.current = el;
    setSourceRect(el.getBoundingClientRect());
    setSelectedFind(find);
    history.pushState({ findId: find.id }, '', findUrl(find));
    applyFindMeta(find);
  }, [findUrl, applyFindMeta]);

  // Navigate to a different find inside the open carousel: track URL + meta,
  // but keep activeCardRef (FLIP source/target) on the originally-clicked card.
  const navigateFind = useCallback((find: Find & { clovers: Clover[] }) => {
    setSelectedFind(find);
    history.replaceState({ findId: find.id }, '', findUrl(find));
    applyFindMeta(find);
  }, [findUrl, applyFindMeta]);

  const getTargetRect = useCallback(() =>
    activeCardRef.current?.getBoundingClientRect() ?? null
  , []);

  const closeFind = useCallback(() => {
    setSelectedFind(null);
    setSourceRect(null);
    activeCardRef.current = null;
    if (/\/find\/[^/]+$/.test(window.location.pathname)) {
      const back = window.location.pathname.replace(/\/find\/[^/]+$/, '') || '/';
      history.replaceState(null, '', back);
    }
    if (origMetaRef.current) applyPageMeta(origMetaRef.current);
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

  // Month label data: one entry per month, newest-first, with numRows = how many grid rows that month spans.
  // Used to render labels in a separate flex column where each month has a proportional-height wrapper.
  const monthLabelData: { date: Date; numRows: number }[] = [];
  {
    const seen = new Set<string>();
    const entries: { date: Date; rowIndex: number }[] = [];
    reversedCells.forEach((date, i) => {
      if (!date) return;
      if (date > today) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ date, rowIndex: Math.floor(i / colCount) });
      }
    });
    // Sort newest month first (by date descending) so labels render top-to-bottom = newest-to-oldest.
    // When two months share the same rowIndex (e.g. May 31 + Jun 1 in the same week), the later month stays on top.
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Compute section end for each entry.
    // When entries share a rowIndex, the earlier entry gets at least rowIndex+1 so it occupies ≥1 row.
    const sectionEnds = entries.map((entry, idx) => {
      const nextRowIndex = idx + 1 < entries.length ? entries[idx + 1].rowIndex : totalRows;
      return Math.max(entry.rowIndex + 1, nextRowIndex);
    });

    entries.forEach((entry, idx) => {
      // Section starts where the previous section ended (not at entry.rowIndex, which could be shared).
      const sectionStart = idx === 0 ? 0 : sectionEnds[idx - 1];
      const numRows = Math.max(1, sectionEnds[idx] - sectionStart);
      monthLabelData.push({ date: entry.date, numRows });
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

  // --- Empty-month collapsing ----------------------------------------------
  // By default, months with no finds are hidden so the user isn't forced to
  // scroll through large empty stretches. A single "Reveal Empty Months" button
  // sits at the most recent gap and expands every hidden month at once.
  const monthsWithFinds = new Set<string>();
  finds.forEach(f => {
    const d = new Date(f.found_at);
    monthsWithFinds.add(`${d.getFullYear()}-${d.getMonth()}`);
  });

  // monthLabelData partitions every grid row into a contiguous, newest-first
  // month section. Tag each reversed row with its month section index.
  const rowMonthIndex: number[] = new Array(totalRows).fill(-1);
  {
    let r = 0;
    monthLabelData.forEach(({ numRows }, mi) => {
      for (let k = 0; k < numRows && r < totalRows; k++, r++) rowMonthIndex[r] = mi;
    });
  }

  // A month may be hidden only if it has no finds AND no day still carries luck.
  // The current month is always shown, so collapsing begins at the previous month.
  // In a find-less month luck only decays, so day 1 holds the month's peak — if it
  // rounds to zero (no cell tint) the whole month is dark and safe to collapse.
  const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const monthCollapsible = monthLabelData.map(({ date }) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (key === currentMonthKey) return false;
    if (monthsWithFinds.has(key)) return false;
    const peakLuck = Math.round(computeLuck(finds, new Date(date.getFullYear(), date.getMonth(), 1, 23, 59, 59)));
    return peakLuck <= 0;
  });

  // Rows eligible to hide: in a collapsible month and (defensively) holding no find.
  const findRowSet = new Set(findReversedRows);
  const collapsibleRows = new Set<number>();
  for (let r = 0; r < totalRows; r++) {
    if (!findRowSet.has(r) && monthCollapsible[rowMonthIndex[r]]) collapsibleRows.add(r);
  }
  // A row starts a new unlucky period (gets its own button) when it's collapsible
  // and the row above it isn't — i.e. the top of each maximal run of hidden rows.
  const isPeriodStart = (r: number) => collapsibleRows.has(r) && !collapsibleRows.has(r - 1);

  // Tag every collapsible row with its period id (the run's top row), so each
  // period can be revealed independently.
  const periodStartOf = new Map<number, number>();
  {
    let runStart = -1;
    for (let r = 0; r < totalRows; r++) {
      if (!collapsibleRows.has(r)) continue;
      if (isPeriodStart(r)) runStart = r;
      periodStartOf.set(r, runStart);
    }
  }
  // A row is hidden only while its own period stays collapsed.
  const isHidden = (r: number) => collapsibleRows.has(r) && !revealedPeriods.has(periodStartOf.get(r)!);

  // Earliest→latest hidden month per period, for the button's range label. Uses
  // each row's assigned month (not raw cell dates) so boundary weeks that straddle
  // a shown month don't bleed into the range.
  const periodRange = new Map<number, { min: Date; max: Date }>();
  for (let r = 0; r < totalRows; r++) {
    if (!collapsibleRows.has(r)) continue;
    const ps = periodStartOf.get(r)!;
    const monthDate = monthLabelData[rowMonthIndex[r]].date;
    const cur = periodRange.get(ps);
    if (!cur) periodRange.set(ps, { min: monthDate, max: monthDate });
    else { if (monthDate < cur.min) cur.min = monthDate; if (monthDate > cur.max) cur.max = monthDate; }
  }

  // The reveal button spans this many grid rows, so its taller content (waves +
  // label + range) has breathing room above and below instead of overlapping
  // day cells. Mobile cells are short (~1.5rem), so it needs more of them to fit.
  const BUTTON_ROWS = colCount === 1 ? 9 : 3;

  // Map each original reversed row to its displayed row. A still-hidden run is
  // dropped and replaced by one button at its top; a revealed run renders inline.
  const displayRowOf = new Map<number, number>();
  const buttons: { displayRow: number; periodStart: number }[] = [];
  {
    let dr = 0;
    for (let r = 0; r < totalRows; r++) {
      if (isHidden(r)) {
        if (isPeriodStart(r)) { buttons.push({ displayRow: dr, periodStart: r }); dr += BUTTON_ROWS; }
        continue;
      }
      displayRowOf.set(r, dr);
      dr++;
    }
  }
  const displayTotalRows = displayRowOf.size + buttons.length * BUTTON_ROWS;

  // First visible day cell — anchors the height-measuring probe (the newest cell
  // can live in a hidden month, so we can't rely on index 0).
  let firstVisibleCellIndex = -1;
  for (let i = 0; i < reversedCells.length; i++) {
    if (reversedCells[i] && displayRowOf.has(Math.floor(i / colCount))) { firstVisibleCellIndex = i; break; }
  }

  // Compute the sentinel fraction (0–1 of total column height) for each find.
  // Approximate column height from measured row metrics.
  const rowH = cellHeightPx + rowGapPx;
  const approxColH = displayTotalRows * rowH + dowRowHeightPx + rowGapPx;
  // Scrollable range within the column: how far the user can actually scroll before the
  // page bottom is hit. Clamped to at least half the column so short calendars still work.
  const usableH = approxColH > 0 ? Math.max(approxColH * 0.5, approxColH - viewportH) : 0;

  const findSentinelData = sortedFinds.map((find, idx) => {
    if (evenSentinels) {
      const N = sortedFinds.length;
      // N photos need only N−1 transitions; the oldest persists after the last fires.
      // Place transition i at (i+1)/N of the usable scroll range.
      const isLast = idx === N - 1;
      const fraction = isLast ? 2 : // sentinel beyond column — never triggered
        approxColH > 0
          ? (idx + 1) * usableH / (N * approxColH)
          : (idx + 1) / N;
      return { find, fraction };
    }
    const row = findReversedRows[idx];
    const displayRow = displayRowOf.get(row) ?? row;
    const group = rowGroups.get(row)!;
    const posInRow = group.indexOf(idx);
    const totalInRow = group.length;
    return { find, fraction: (displayRow + posInRow / totalInRow) / displayTotalRows };
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

  // Left-column label sections in display order. Hidden runs collapse away; a
  // spacer section per run keeps the column aligned with each grid button.
  // Grouping visible rows by month (rather than re-deriving emptiness) keeps the
  // two columns aligned even at week-rows shared by an empty and a non-empty month.
  type LabelSection = { key: string; date: Date | null; rows: number };
  const labelSections: LabelSection[] = [];
  {
    let currentMi = -1;
    let currentRows = 0;
    const flush = () => {
      if (currentRows > 0) {
        const { date } = monthLabelData[currentMi];
        labelSections.push({ key: `${date.getFullYear()}-${date.getMonth()}`, date, rows: currentRows });
      }
      currentRows = 0;
    };
    for (let r = 0; r < totalRows; r++) {
      if (isHidden(r) && isPeriodStart(r)) {
        flush();
        labelSections.push({ key: `reveal-spacer-${r}`, date: null, rows: BUTTON_ROWS });
      }
      if (!displayRowOf.has(r)) continue;
      const mi = rowMonthIndex[r];
      if (mi !== currentMi) { flush(); currentMi = mi; }
      currentRows++;
    }
    flush();
  }

  return (
    <>
    <div className="flex gap-0" style={viewportH > 0 ? { minHeight: viewportH * 1.5 } : undefined}>
      {/* Month label column — separate from grid so sticky works via flex-height sections */}
      <div className="cal-month-col">
          {colCount > 1 && dowRowHeightPx > 0 && (
            <div style={{ height: dowRowHeightPx + rowGapPx, flexShrink: 0 }} />
          )}
          {labelSections.map(({ key, date, rows }, idx) => {
            // Pixel-exact height: rows × (cellH + gap), minus one gap on the last section.
            const rowH = cellHeightPx + rowGapPx;
            const isLast = idx === labelSections.length - 1;
            const exactH = cellHeightPx > 0 ? rows * rowH - (isLast ? rowGapPx : 0) : undefined;
            return (
              <div
                key={key}
                style={exactH !== undefined ? { height: exactH, flexShrink: 0 } : { flex: rows }}
              >
                {date && (
                  <div className="cal-month-label">
                    <MonthLabel date={date} today={today} />
                  </div>
                )}
              </div>
            );
          })}
      </div>
      {/* Calendar grid */}
      <div className="cal-grid-col">
      <div
        ref={gridRef}
        className="cal-grid grid"
        style={{
          '--cal-gap': 'clamp(2px, .5vw, 6px)',
          '--chamfer': 'calc(var(--cal-gap) * 3.2)',
          gap: 'var(--cal-gap)',
        } as React.CSSProperties}
      >
        {/* Day-of-week header row — row 1, only in 7-column layout */}
        {colCount > 1 && (() => {
          const ALL_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
          const weekDays = weekStart === 0 ? ALL_ABBR : [...ALL_ABBR.slice(1), ALL_ABBR[0]];
          return weekDays.map((abbr, idx) => (
            <div
              key={`dow-${abbr}`}
              ref={idx === 0 ? dowProbeRef : undefined}
              className={`cal-dow-label day-num-${idx + 1}`}
              style={{ gridRowStart: 1 }}
            >
              {abbr}
            </div>
          ));
        })()}

        {/* Circle pass — rendered first so cells sit on top in DOM stacking order */}
        {reversedCells.map((date, i) => {
          if (!date) return null;
          const added = luckAddedOnDay(finds, date);
          if (added <= 0) return null;
          const diameter = luckAddedToCircleDiameterPct(added);
          const rowIndex = Math.floor(i / colCount);
          const displayRow = displayRowOf.get(rowIndex);
          if (displayRow === undefined) return null;
          const colIndex = (i % colCount) + 1;
          return (
            <div
              key={`circle-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              className={colCount > 1 ? `day-num-${colIndex} pointer-events-none cal-find-circle` : 'pointer-events-none cal-find-circle'}
              style={{
                gridRowStart: displayRow + 2,
                ...(colCount === 1 && { gridColumn: 1 }),
                width: '100%',
                height: 0,
                alignSelf: 'center',
                position: 'relative',
                overflow: 'visible',
              }}
            >
              <div className="cal-find-disc" style={{ width: `${diameter}%` }} />
            </div>
          );
        })}

        {/* Cell pass — rendered after circles, sits on top */}
        {reversedCells.map((date, i) => {
          const rowIndex = Math.floor(i / colCount);
          const displayRow = displayRowOf.get(rowIndex);
          if (displayRow === undefined) return null;
          const colIndex = (i % colCount) + 1;

          if (!date) return (
            <div
              key={`blank-${i}`}
              className={`aspect-square day-num-${colIndex}`}
              style={{ gridRowStart: displayRow + 2 }}
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
          const topFind = sortedFinds.find(f => {
            const fd = new Date(f.found_at);
            return fd.getFullYear() === date.getFullYear() && fd.getMonth() === date.getMonth() && fd.getDate() === dayNum;
          }) ?? null;

          const dayCell = (
            <div
              key={cellKey}
              ref={i === firstVisibleCellIndex ? probeRef : undefined}
              className={['day-cell', `day-num-${colIndex}`, isWeekend && 'weekend', isToday && 'today', topFind && 'has-find'].filter(Boolean).join(' ')}
              style={{
                gridRowStart: displayRow + 2,
                '--luck': opacity,
              } as React.CSSProperties}
              onClick={topFind ? e => openFind(topFind, e.currentTarget as HTMLElement) : undefined}
            >
              {/* Clover marker */}
              {leafCount !== null && added > 0 && (
                <div className="cal-find-marker">
                  <div style={{ width: `${luckAddedToMarkerSize(added) * 100}%` }}>
                    <CloverMarker leafCount={leafCount} rotation={markerRotation(cellKey, 0)} filled />
                  </div>
                </div>
              )}

              <span className={['day-cell-label', (isToday || dayNum === 1) && 'notable'].filter(Boolean).join(' ')}>
                {dayNum === 1
                  ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()]} 1`
                  : dayNum}
              </span>
            </div>
          );

          return dayCell;
        })}

        {/* Reveal buttons — one per hidden unlucky period; each reveals only its
            own block and shows the date range it's hiding. */}
        {buttons.map(({ displayRow, periodStart }) => {
          const range = periodRange.get(periodStart);
          return (
            <div
              key={`reveal-${periodStart}`}
              className="cal-reveal-row"
              style={{
                gridRow: `${displayRow + 2} / span ${BUTTON_ROWS}`,
                gridColumn: colCount > 1 ? '1 / -1' : 1,
                '--button-rows': BUTTON_ROWS,
                ...(cellHeightPx ? { '--cell-h': `${cellHeightPx}px` } : {}),
              } as React.CSSProperties}
            >
              <button
                type="button"
                className="cal-reveal-button"
                onClick={() => setRevealedPeriods(prev => new Set(prev).add(periodStart))}
              >
                <svg className="cal-wave cal-wave-top" viewBox="0 0 12 48" preserveAspectRatio="none" aria-hidden="true">
                  <path d={REVEAL_WAVE_PATH} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="cal-reveal-text">
                  <span className="cal-reveal-label">{SHOW_EMPTY_MONTHS}</span>
                  {range && <span className="cal-reveal-range">{formatHiddenRange(range.min, range.max)}</span>}
                </span>
                <svg className="cal-wave cal-wave-bottom" viewBox="0 0 12 48" preserveAspectRatio="none" aria-hidden="true">
                  <path d={REVEAL_WAVE_PATH} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
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
        {header && <div className="cal-photo-header">{header}</div>}
        {findSentinelData.map(({ find, fraction }) => (
          <div
            key={`sentinel-${find.id}`}
            ref={el => registerSentinel(el as HTMLElement | null, find.id)}
            data-find-id={find.id}
            className="absolute inset-x-0 h-0 pointer-events-none"
            style={{ top: `${fraction * 100}%` }}
          />
        ))}

        <div className="sticky top-0 h-screen flex items-start py-4">
          {/* Square container: portrait fills height (3/4 wide), landscape fills width (3/4 tall) — equal area, no crop */}
          <div className="cal-photo-frame relative w-full aspect-square shrink-0">
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

              // Only the top card is clickable — clicking a buried card has no clean visual meaning.
              const cardClass = `absolute overflow-hidden rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${
                isLandscape ? 'inset-x-0 top-1/2 aspect-[4/3]' : 'inset-y-0 left-1/2 aspect-[3/4]'
              }${isTop ? ' cursor-pointer' : ''}`;
              // Hide the card while its dialog is open.
              const isDialogOpen = selectedFind?.id === find.id;
              const cardStyle = { zIndex: stackIdx + 1, opacity: isDialogOpen ? 0 : opacity, transition: isDialogOpen ? 'none' : transition, transform: baseTransform };
              return (
                <div
                  key={find.id}
                  className={cardClass}
                  style={cardStyle}
                  onClick={isTop ? e => openFind(find, e.currentTarget as HTMLElement) : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={find.photo_url}
                    alt=""
                    loading="lazy"
                    onLoad={e => handleImageLoad(e, find.id)}
                    ref={el => { if (el?.complete && el.naturalWidth > 0) detectOrientation(el, find.id); }}
                    className="w-full h-full object-cover block"
                  />
                  <div className="cal-location-label absolute bottom-0 left-0 right-0 flex flex-col items-start justify-end-safe gap-2 px-2 py-2 aspect-video min-w-60 font-semibold text-xs"
                    style={{ background: 'linear-gradient(20deg, color-mix(in srgb, var(--color-background) 90%, rgba(0,0,0,.5)), transparent 50%, transparent)'}}>
                    <span className={[
                        'truncate flex items-center gap-1 transition-opacity duration-300',
                        isTop && find.location_name ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}>
                      <MapPin size={12} strokeWidth={2} className="fill-current shrink-0" />{find.location_name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    <FindCardDialog finds={sortedFinds} activeId={selectedFind?.id ?? null} userId={userId} username={username} onClose={closeFind} onNavigate={navigateFind} sourceRect={sourceRect} getTargetRect={getTargetRect} imperativeCloseRef={dialogCloseRef} orientations={orientations} />

    {/* Temporary controls palette */}
    {process.env.NODE_ENV === 'development' && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-2xl shadow-xl text-xs font-medium"
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
      <button onClick={() => { setWeekStart(1); savePrefs({ weekStart: 1 }); }}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: weekStart === 1 ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Mon
      </button>
      <button onClick={() => { setWeekStart(0); savePrefs({ weekStart: 0 }); }}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: weekStart === 0 ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Sun
      </button>
      <div className="w-px h-4 mx-1" style={{ background: 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' }} />
      <button onClick={() => setEvenSentinels(true)}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: evenSentinels ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Even scroll
      </button>
      <button onClick={() => setEvenSentinels(false)}
        className="px-3 py-1.5 rounded-xl transition-colors"
        style={{ background: !evenSentinels ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}>
        Date scroll
      </button>
    </div>}
    </>
  );
}


