'use client'

import Link from 'next/link'
import { computeLuck, luckAddedOnDay, luckToOpacity, luckAddedToMarkerSize, luckAddedToCircleDiameterPct } from '@/lib/luck'
import { CloverMarker } from '@/components/clover-marker'
import { UserAvatar } from '@/components/user-avatar'
import { InterrobangIcon } from '@/components/icons/interrobang'
import { markerRotation } from '@/lib/marker-rotation'
import { luckSentence } from '@/lib/pronouns'
import type { Find, Clover, UserProfile } from '@/types'

interface Props {
  profile: UserProfile
  finds: (Find & { clovers: Clover[] })[]
  luckEndDate: string | null
  weekStart?: 0 | 1
  isOwner?: boolean
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

function formatLuckDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export function UserProfileCard({ profile, finds, luckEndDate, weekStart = 1, isOwner = false }: Props) {
  const today = new Date()
  const endDate = luckEndDate ? new Date(luckEndDate) : null
  const luckExpired = endDate !== null && endDate < today

  // 4-week window: end at luck expiry if in the past, else today
  const windowEnd = (endDate && luckExpired) ? endDate : today

  // Snap to the start of the week containing windowEnd, then go back 3 more weeks.
  // This gives exactly 4 complete aligned weeks with no leading/trailing blanks.
  const dayOfWeek = (windowEnd.getDay() - weekStart + 7) % 7
  const weekStartDate = new Date(windowEnd)
  weekStartDate.setDate(weekStartDate.getDate() - dayOfWeek)
  const firstDay = new Date(weekStartDate)
  firstDay.setDate(firstDay.getDate() - 21)

  // 28 cells built oldest-first, then weeks reversed so newest is at the top
  const allDays: Date[] = []
  const cur = new Date(firstDay)
  for (let i = 0; i < 28; i++) {
    allDays.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  const weeks = [0, 1, 2, 3].map(w => allDays.slice(w * 7, w * 7 + 7))
  weeks.reverse()
  const cells = weeks.flat()

  const possessive = profile.username.endsWith('s')
    ? `${profile.username}’`
    : `${profile.username}’s`

  return (
    <div
      className="rounded-2xl flex flex-col gap-4 p-5 overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent)',
      }}
    >
      {/* Profile header */}
      <div className="flex-1 flex flex-col items-center gap-2 text-center px-2">
        <Link href={`/${profile.username.toLowerCase()}`}>
          <UserAvatar username={profile.username} avatarUrl={profile.avatar_url} fallback={profile.username === 'anonymous' ? <InterrobangIcon /> : undefined} />
        </Link>

        <div className="flex flex-col gap-1 text-balance">
          <h2 className="text-2xl font-semibold text-text-primary capitalize text-serif">
            <Link href={`/${profile.username.toLowerCase()}`}>{profile.username}</Link>
          </h2>
          {profile.bio && (
            <p className="text-base text-text-secondary">{profile.bio}</p>
          )}
          {luckEndDate && (
            <p className="text-sm font-medium text-accent" style={{ color: 'var(--color-text-secondary)' }}>
              {isOwner
                ? `Your luck ${luckExpired ? 'ran' : 'runs'} out on ${formatLuckDate(luckEndDate)}.`
                : luckSentence(profile.pronouns, luckExpired ? 'ran' : 'runs', formatLuckDate(luckEndDate))}
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/${profile.username.toLowerCase()}`}
        className="self-center button button-secondary"
      >
        {profile.username === 'anonymous' ? 'See Anonymous Finds' : isOwner ? 'See your find history' : `See ${possessive} find history`}
      </Link>

      {/* Mini 4-week calendar */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          '--cal-gap': 'clamp(2px, .5vw, 6px)',
          '--chamfer': 'calc(var(--cal-gap) * 3.2)',
          gap: 'var(--cal-gap)',
        } as React.CSSProperties}
      >
        {/* Circle pass — zero-height, sits behind cells */}
        {cells.map((date, i) => {
          const added = luckAddedOnDay(finds, date)
          if (added <= 0) return null
          const diameter = luckAddedToCircleDiameterPct(added)
          const rowIndex = Math.floor(i / 7)
          const colIndex = (i % 7) + 1
          return (
            <div
              key={`circle-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              className="pointer-events-none"
              style={{
                gridRowStart: rowIndex + 1,
                gridColumnStart: colIndex,
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
          )
        })}

        {/* Cell pass — explicit placement so circles don't disturb auto-flow */}
        {cells.map((date, i) => {
          const rowIndex = Math.floor(i / 7)
          const colIndex = (i % 7) + 1
          const cellKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          const added = luckAddedOnDay(finds, date)
          const luck = Math.round(computeLuck(finds, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)))
          const opacity = luckToOpacity(luck)
          const leafCount = dominantLeafCount(finds, date)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const isToday = date.toDateString() === today.toDateString()
          const dayNum = date.getDate()
          const isFirst = dayNum === 1

          return (
            <div
              key={cellKey}
              className={['day-cell aspect-square relative overflow-hidden', isWeekend && 'weekend', isToday && 'today'].filter(Boolean).join(' ')}
              style={{
                gridRowStart: rowIndex + 1,
                gridColumnStart: colIndex,
                borderRadius: 'calc(var(--cal-gap) * 1.7)',
                '--day-bg': `color-mix(in srgb, var(--color-accent) ${Math.round(opacity * 75)}%, var(--color-surface))`,
                background: 'var(--day-bg)',
                ...(isWeekend && {
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - var(--chamfer)), calc(100% - var(--chamfer)) 100%, 0 100%)',
                }),
              } as React.CSSProperties}
            >
              {leafCount !== null && added > 0 && (
                <div
                  className="pointer-events-none absolute"
                  style={{
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
              <span className={['day-cell-label', (isToday || isFirst) && 'notable'].filter(Boolean).join(' ')}>
                {isFirst
                  ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()]} 1`
                  : dayNum}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
