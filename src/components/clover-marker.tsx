'use client'

import { useRef, useEffect } from 'react'
import { cloverPath } from '@/lib/clover-path'

interface CloverMarkerProps {
  leafCount: number
  label?: string
  rotation?: number
  active?: boolean
  dragging?: boolean
  spinning?: boolean
  onMouseDown?: (e: React.MouseEvent<SVGPathElement>) => void
}

export function CloverMarker({
  leafCount,
  label,
  rotation = 0,
  active = false,
  dragging = false,
  spinning = false,
  onMouseDown,
}: CloverMarkerProps) {
  const groupRef = useRef<SVGGElement>(null)
  const animRef  = useRef<Animation | null>(null)
  const rafRef   = useRef<number>(0)

  // Discard cached animation when leaf count changes so it recreates with correct duration.
  useEffect(() => {
    if (animRef.current) {
      animRef.current.cancel()
      animRef.current = null
    }
  }, [leafCount])

  useEffect(() => {
    const el = groupRef.current
    if (!el) return
    cancelAnimationFrame(rafRef.current)

    if (spinning) {
      if (!animRef.current) {
        // Duration scales with leaf count: 1 s per leaf → 4 s at N=4, 8 s at N=8.
        animRef.current = el.animate(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
          { duration: 1000 * leafCount, iterations: Infinity, easing: 'linear' },
        )
        animRef.current.playbackRate = 0
      }
      const anim = animRef.current
      const from = anim.playbackRate
      const t0   = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - t0) / 600, 1)
        anim.playbackRate = from + (1 - from) * t
        if (t < 1) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      const anim = animRef.current
      if (!anim || anim.playbackRate === 0) return
      const from = anim.playbackRate
      const t0   = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - t0) / 500, 1)
        anim.playbackRate = from * (1 - t)
        if (t < 1) rafRef.current = requestAnimationFrame(tick)
        // Leave paused at rate=0 so there's no snap-to-0 jump
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => cancelAnimationFrame(rafRef.current)
  }, [spinning, leafCount])

  // Cancel on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    if (animRef.current) {
      animRef.current.cancel()
      animRef.current = null
    }
  }, [])

  const d = cloverPath(leafCount)

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      overflow="visible"
      style={{ opacity: dragging || active ? 1 : 0.85 }}
    >
      {/*
        Outer group: static per-marker rotation. Inner group: WAAPI spin.
        Label (circle + text) are siblings to the outer group so they stay upright
        regardless of either the static rotation or the spin.
      */}
      {active && (
        <circle cx="50" cy="50" r="48" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeDasharray="6 3.5" opacity="0.9" style={{ pointerEvents: 'none' }} />
      )}
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50% 50%' }}>
        <g ref={groupRef} style={{ transformOrigin: '50% 50%' }}>
          {/* Hit-test area: transparent fill so only the inside of the clover responds */}
          <path d={d} fill="transparent" style={{ pointerEvents: 'fill', cursor: onMouseDown ? 'grab' : 'default' }} onMouseDown={onMouseDown} />
          <path d={d} fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
        </g>
      </g>
      {label && (
        <>
          <circle cx="50" cy="50" r="11" fill="white" />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-accent)"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
            fontSize="14"
            style={{ userSelect: 'none' }}
          >
            {label}
          </text>
        </>
      )}
    </svg>
  )
}
