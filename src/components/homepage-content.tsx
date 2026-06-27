'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { HomepagePhotoStack } from '@/components/homepage-photo-stack'
import { UserProfileCard } from '@/components/user-profile-card'
import { HomepageMap } from '@/components/homepage-map'
import type { Find, Clover, UserProfile } from '@/types'
import { SHARE_A_FIND } from '@/lib/constants'
import { loadPrefs, savePrefs } from '@/lib/prefs'

interface Props {
  userId: string | null
  heroFinds: (Find & { clovers: Clover[] })[]
  profiles: UserProfile[]
  findsByUser: Record<string, (Find & { clovers: Clover[] })[]>
  luckEndDates: Record<string, string | null>
  mappableFinds: Find[]
}

export function HomepageContent({ userId, heroFinds, profiles, findsByUser, luckEndDates, mappableFinds }: Props) {
  const [photoSide, setPhotoSide] = useState<'left' | 'right'>('left')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [weekStart, setWeekStart] = useState<0 | 1>(1)
  const skipOrientationFirst = useRef(true)
  const skipThemeFirst = useRef(true)

  useEffect(() => {
    const prefs = loadPrefs()
    if (prefs.orientation === 'left-handed') setPhotoSide('right')
    if (prefs.theme === 'light') setTheme('light')
    if (prefs.weekStart === 0) setWeekStart(0)
    // Migrate legacy localStorage-only prefs into the cookie (so the server can
    // apply them before paint on future loads) and reflect them on this load.
    document.documentElement.dataset.orientation =
      prefs.orientation === 'left-handed' ? 'left-handed' : 'right-handed'
    if (prefs.theme === 'light') document.documentElement.dataset.theme = 'light'
    savePrefs(prefs)
  }, [])

  useEffect(() => {
    if (skipOrientationFirst.current) { skipOrientationFirst.current = false; return }
    const orientation = photoSide === 'left' ? 'right-handed' : 'left-handed'
    document.documentElement.dataset.orientation = orientation
    savePrefs({ orientation })
  }, [photoSide])

  useEffect(() => {
    if (skipThemeFirst.current) { skipThemeFirst.current = false; return }
    document.documentElement.dataset.theme = theme
    savePrefs({ theme })
  }, [theme])

  return (
    <>
      {/* Hero */}
      <section className="w-full" style={{ background: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center justify-center">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 text-balance">
            <p className="text-sm uppercase tracking-widest text-accent">Share Something Supernumerary</p>
            <h1 className="text-4xl text-serif text-text-primary">
              Fourag is a Public Patch for Spreading the Serendipity of Four-Leaf (or&nbsp;Even More-Leaf) Clovers
            </h1>
            <div className="flex flex-col gap-2">
              <p className="text-base  text-text-secondary ">
              You’re encouraged to share pictures of these pint-sized polyphyllous plants, but not to pick them. Leave the leaves to continue growing so their luck and diversity can spread for everyone to discover and enjoy!
              </p>
            </div>
          </div>
          <Link
            href="/account/finds/new"
            className="self-start button button-primary"
          >
            {userId ? SHARE_A_FIND : 'Share a find to join'}
          </Link>
        </div>

        {heroFinds.length > 0 && (
          <div className="homepage-hero-photos px-4">
            <HomepagePhotoStack finds={heroFinds} />
          </div>
        )}
      </div>
      </section>

      {/* User profile cards */}
      {profiles.length > 0 && (
        <section className="mx-auto max-w-(--width-main-max) px-4 sm:px-6 pt-4 pb-12 md:pb-24 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 md:gap-12">
          {profiles.map(profile => (
            <UserProfileCard
              key={profile.id}
              profile={profile}
              finds={findsByUser[profile.id] ?? []}
              luckEndDate={luckEndDates[profile.id] ?? null}
              weekStart={weekStart}
              isOwner={userId === profile.id}
            />
          ))}
        </section>
      )}

      {/* Map — full viewport width */}
      {mappableFinds.length > 0 && (
        <section>
          <div style={{ height: '50vh' }}>
            <HomepageMap finds={mappableFinds} />
          </div>
        </section>
      )}

      {/* Controls */}
      {process.env.NODE_ENV === 'development' && <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-2xl shadow-xl text-xs font-medium"
        style={{ background: 'var(--color-surface)', border: '1px solid color-mix(in srgb, var(--color-text-primary) 12%, transparent)' }}
      >
        <button
          onClick={() => setPhotoSide('left')}
          className="px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: photoSide === 'left' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}
        >
          Right-handed
        </button>
        <button
          onClick={() => setPhotoSide('right')}
          className="px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: photoSide === 'right' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}
        >
          Left-handed
        </button>
        <div className="w-px h-4 mx-1" style={{ background: 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' }} />
        <button
          onClick={() => setTheme('dark')}
          className="px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: theme === 'dark' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}
        >
          Dark
        </button>
        <button
          onClick={() => setTheme('light')}
          className="px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: theme === 'light' ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}
        >
          Light
        </button>
        <div className="w-px h-4 mx-1" style={{ background: 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' }} />
        <button
          onClick={() => { setWeekStart(1); savePrefs({ weekStart: 1 }) }}
          className="px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: weekStart === 1 ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}
        >
          Mon
        </button>
        <button
          onClick={() => { setWeekStart(0); savePrefs({ weekStart: 0 }) }}
          className="px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: weekStart === 0 ? 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)' : 'transparent', color: 'var(--color-text-primary)' }}
        >
          Sun
        </button>
      </div>}
    </>
  )
}
