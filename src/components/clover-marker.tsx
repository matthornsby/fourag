'use client'

import { useRef, useEffect } from 'react'

function shapeParams(N: number) {
  const t = Math.max(0, Math.min(1, (N - 4) / (10 - 4)))
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    k:            lerp(0.146, 0.116),
    hLobeScale:   1.95,
    hValleyScale: lerp(0.42, 1.27),
  }
}

function cloverPath(N: number): string {
  const cx = 50, cy = 50, R_out = 46
  const { k, hLobeScale, hValleyScale } = shapeParams(N)
  const R_in   = R_out * (1 - k) / (1 + k)
  const hBase  = (R_in + R_out) * Math.PI / (6 * N)
  const hLobe  = hBase * hLobeScale
  const hValley = hBase * hValleyScale

  const lobeAng  = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N
  const valleyAng = (i: number) => lobeAng(i) - Math.PI / N

  const pt  = (r: number, θ: number) => ({ x: cx + r * Math.cos(θ), y: cy + r * Math.sin(θ) })
  const tan = (θ: number) => ({ x: -Math.sin(θ), y: Math.cos(θ) })
  const f   = (n: number) => n.toFixed(3)

  const v0 = pt(R_in, valleyAng(0))
  let d = `M ${f(v0.x)},${f(v0.y)}`

  for (let i = 0; i < N; i++) {
    const vStart = pt(R_in, valleyAng(i))
    const lobe   = pt(R_out, lobeAng(i))
    const vEnd   = pt(R_in, valleyAng((i + 1) % N))

    const tvS = tan(valleyAng(i))
    const tL  = tan(lobeAng(i))
    const tvE = tan(valleyAng((i + 1) % N))

    const cp1 = { x: vStart.x + hValley * tvS.x, y: vStart.y + hValley * tvS.y }
    const cp2 = { x: lobe.x   - hLobe   * tL.x,  y: lobe.y   - hLobe   * tL.y  }
    d += ` C ${f(cp1.x)},${f(cp1.y)} ${f(cp2.x)},${f(cp2.y)} ${f(lobe.x)},${f(lobe.y)}`

    const cp3 = { x: lobe.x  + hLobe   * tL.x,   y: lobe.y  + hLobe   * tL.y  }
    const cp4 = { x: vEnd.x  - hValley * tvE.x,  y: vEnd.y  - hValley * tvE.y }
    d += ` C ${f(cp3.x)},${f(cp3.y)} ${f(cp4.x)},${f(cp4.y)} ${f(vEnd.x)},${f(vEnd.y)}`
  }
  return d + ' Z'
}

interface CloverMarkerProps {
  leafCount: number
  label?: string
  rotation?: number
  active?: boolean
  dragging?: boolean
  spinning?: boolean
}

export function CloverMarker({
  leafCount,
  label,
  rotation = 0,
  active = false,
  dragging = false,
  spinning = false,
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
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50% 50%' }}>
        <g ref={groupRef} style={{ transformOrigin: '50% 50%' }}>
          <path d={d} fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round" />
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
