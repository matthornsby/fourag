import { FindCard } from "@/components/find-card";
import { CloverMarker } from "@/components/clover-marker";
import { markerRotation } from "@/lib/marker-rotation";
import { computeLuck, luckAddedOnDay, luckToOpacity, luckAddedToMarkerSize } from "@/lib/luck";
import type { Find, Clover } from "@/types";

interface Props {
  finds: (Find & { clovers: Clover[] })[];
}

function dominantLeafCount(finds: (Find & { clovers: Clover[] })[], date: Date): number {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const clovers = finds
    .filter(f => {
      const fd = new Date(f.found_at)
      return fd.getFullYear() === y && fd.getMonth() === m && fd.getDate() === d
    })
    .flatMap(f => f.clovers)
  if (clovers.length === 0) return 4
  return Math.max(...clovers.map(c => c.leaf_count))
}

function MonthLabel({ date, today }: { date: Date; today: Date }) {
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const month = date.getMonth();
  const year = date.getFullYear();
  const monthName = date.toLocaleDateString("en-US", { month: "long" });

  if (month === currentMonth && year === currentYear) {
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-text-primary">This Month</span>
        <span className="text-xs text-text-secondary">{monthName}</span>
      </div>
    );
  }

  if (month === prevMonth && year === prevYear) {
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-text-primary">Last Month</span>
        <span className="text-xs text-text-secondary">{monthName}</span>
      </div>
    );
  }

  if (year === currentYear) {
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-text-primary">{monthName}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm font-semibold text-text-primary">{monthName}</span>
      <span className="text-xs text-text-secondary">{year}</span>
    </div>
  );
}

export function FindsCalendar({ finds }: Props) {
  if (finds.length === 0) return null;

  const today = new Date();

  const earliest = finds.reduce((min, f) =>
    new Date(f.found_at) < new Date(min.found_at) ? f : min
  );
  const earliestDate = new Date(earliest.found_at);
  const startOfFirstMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);

  // Build every day from the start of the earliest month through the end of the current week.
  const endOfCurrentWeek = new Date(today);
  endOfCurrentWeek.setDate(today.getDate() + (6 - today.getDay())); // advance to Saturday

  const allDays: Date[] = [];
  const cursor = new Date(startOfFirstMonth);
  while (cursor <= endOfCurrentWeek) {
    allDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Pad leading blanks so day 1 falls in the correct column (0=Sun).
  const leadingBlanks = startOfFirstMonth.getDay();
  const cells: (Date | null)[] = [...Array(leadingBlanks).fill(null), ...allDays];
  while (cells.length % 7 !== 0) cells.push(null);

  // Split into weeks and reverse so the most recent week is at the top.
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  weeks.reverse();
  const reversedCells = weeks.flat();

  // For each month, find the topmost row (lowest index) it appears in.
  const monthFirstRows = new Map<string, { rowIndex: number; date: Date }>();
  weeks.forEach((week, rowIndex) => {
    for (const date of week) {
      if (!date) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!monthFirstRows.has(key)) {
        monthFirstRows.set(key, {
          rowIndex,
          date: new Date(date.getFullYear(), date.getMonth(), 1),
        });
      }
    }
  });

  // Sort newest-first. If a month boundary falls inside the current week, two
  // months share rowIndex 0 — push the older one down so labels don't overlap.
  const monthEntries = Array.from(monthFirstRows.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .reduce<{ rowIndex: number; date: Date }[]>((acc, entry) => {
      const prev = acc[acc.length - 1];
      acc.push({ ...entry, rowIndex: Math.max(entry.rowIndex, prev ? prev.rowIndex + 1 : 0) });
      return acc;
    }, []);

  const monthSpans = monthEntries.map((entry, i) => {
    const next = monthEntries[i + 1];
    const endRow = next
      ? Math.max(entry.rowIndex, next.rowIndex - 1)
      : weeks.length - 1;
    return { ...entry, endRow };
  });

  const sortedFinds = [...finds].sort(
    (a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime()
  );

  return (
    <div className="flex flex-col gap-4">
      {/*
        Single 8-column grid: columns 1-7 are day cells (minmax(0,1fr) each),
        column 8 is the label/photo column (min 80px, max one cell-size share).
        Day cells are explicitly placed so auto-placement never spills into col 8.
        Row heights come from the aspect-square day cells, so col 8's min-width
        can't distort row heights at narrow viewports.
      */}
      <div
        className="max-w-[760px]"
        style={{
          display: 'grid',
          gap: 'var(--cal-gap)',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr)) minmax(80px, calc((100% - 7 * var(--cal-gap)) / 8))',
          '--cal-gap': 'clamp(2px, 0.9vw, 8px)',
        } as React.CSSProperties}
      >
        {reversedCells.map((date, i) => {
          const rowIndex = Math.floor(i / 7);
          const colIndex = (i % 7) + 1;

          if (!date) return (
            <div
              key={`blank-${i}`}
              className="aspect-square"
              style={{ gridRow: rowIndex + 1, gridColumn: colIndex }}
            />
          );

          const dayNum = date.getDate();
          const cellKey = `${date.getFullYear()}-${date.getMonth()}-${dayNum}`;
          const isToday = date.toDateString() === today.toDateString();
          const luck = Math.round(computeLuck(finds, new Date(date.getFullYear(), date.getMonth(), dayNum, 23, 59, 59)));
          const opacity = luckToOpacity(luck);
          const added = luckAddedOnDay(finds, date);
          const markerSize = added > 0 ? luckAddedToMarkerSize(added) : 0;
          const leafCount = dominantLeafCount(finds, date);
          const rotation = markerRotation(`cal-${cellKey}`, 0);

          return (
            <div
              key={cellKey}
              className="day-cell relative aspect-square group cursor-default overflow-hidden"
              style={{
                gridRow: rowIndex + 1,
                gridColumn: colIndex,
                borderRadius: 'calc(var(--cal-gap) * 0.8)',
                '--day-bg': `color-mix(in srgb, var(--color-accent) ${opacity * 100 * .75}%, var(--color-surface))`,
                backgroundColor: 'var(--day-bg)',
                outline: isToday ? '1.5px solid var(--color-text-primary)' : undefined,
              } as React.CSSProperties}
            >
              {luck > 0 && (
                <span className="absolute inset-0 z-10 flex items-center justify-center text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ borderRadius: 'inherit', backgroundColor: 'rgba(0,16,33,0.75)', color: 'rgba(186,255,70,1)' }}
                >
                  {luck}
                </span>
              )}

              <span
                className="day-cell-label absolute top-1 right-1 text-[10px] leading-none opacity-60"
                style={{
                  color: 'contrast-color(var(--day-bg))',
                  opacity: isToday || dayNum === 1 ? '100%' : undefined,
                  fontWeight: isToday || dayNum === 1 ? '600' : undefined,
                }}
              >
                {dayNum === 1
                  ? `${date.toLocaleDateString("en-GB", { month: "short" })} 1`
                  : dayNum}
              </span>

              {markerSize > 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ padding: `${((1 - markerSize) / 2) * 100}%` }}
                >
                  <CloverMarker leafCount={leafCount} rotation={rotation} />
                </div>
              )}
            </div>
          );
        })}

        {/* Month labels in col 8 — span their month's full row range, sticky inside */}
        {monthSpans.map(({ rowIndex, endRow, date }) => (
          <div
            key={`month-${date.getFullYear()}-${date.getMonth()}`}
            style={{ gridColumn: 8, gridRow: `${rowIndex + 1} / ${endRow + 2}` }}
          >
            <div className="sticky top-2">
              <MonthLabel date={date} today={today} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {sortedFinds.map((find) => (
          <FindCard key={find.id} find={find} />
        ))}
      </div>
    </div>
  );
}
