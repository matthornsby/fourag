'use client'

import { useEffect, useRef } from 'react'
import { layers, namedTheme } from 'protomaps-themes-base'
import type { Map, Marker, StyleSpecification } from 'maplibre-gl'
import { cloverPath } from '@/lib/clover-path'
import { markerRotation } from '@/lib/marker-rotation'

interface Props {
  lat: number
  lng: number
  leafCount?: number
  findId?: string
  theme?: string
  isApproximate?: boolean
}

/** GeoJSON polygon approximating a circle of radiusM metres centred on [lng, lat]. */
function circlePolygon(lng: number, lat: number, radiusM: number, steps = 64) {
  const R = 6371000
  const dLat = (radiusM / R) * (180 / Math.PI)
  const dLng = dLat / Math.cos(lat * Math.PI / 180)
  const coords = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]
  })
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} }
}

const KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY!

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Read a CSS custom property from the document root. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Parse a #rrggbb hex string into [r, g, b]. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Mix a hex color toward white (factor 0–1). */
function lighten(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const mix = (c: number) => Math.round(Math.min(255, c + (255 - c) * factor))
  return `#${[r, g, b].map(mix).map(n => n.toString(16).padStart(2, '0')).join('')}`
}

/** Mix a hex color toward black (factor 0–1). */
function darken(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const mix = (c: number) => Math.round(c * (1 - factor))
  return `#${[r, g, b].map(mix).map(n => n.toString(16).padStart(2, '0')).join('')}`
}

// ---------------------------------------------------------------------------
// Theme builder — reads CSS vars, derives full Protomaps palette
// ---------------------------------------------------------------------------

function buildTheme(isLight: boolean) {
  const bg     = cssVar('--color-background')   // e.g. #001831 / #ffffff
  const accent = cssVar('--color-accent')        // e.g. #BAFF46 / #5a9e00

  if (isLight) {
    // Light: use Protomaps' light palette, tint accent-able things with app accent
    const base = namedTheme('light')
    return {
      ...base,
      // Keep roads/labels as-is; just ensure background matches the app
      background: bg,
    }
  }

  // Dark: derive the entire palette from the app's background navy
  // bg = #001831 → all tones are lightened/shifted variants of that hue

  const l1  = lighten(bg, 0.06)   // ~#0c243d  — earth / landuse base
  const l2  = lighten(bg, 0.12)   // ~#18304a  — pedestrian / aerodrome
  const l3  = lighten(bg, 0.20)   // ~#283e56  — buildings
  const l4  = lighten(bg, 0.30)   // ~#395163  — major roads
  const l5  = lighten(bg, 0.42)   // ~#4d6475  — highway
  const l6  = lighten(bg, 0.55)   // ~#617888  — labels major
  const l7  = lighten(bg, 0.35)   // ~#3f5a6b  — labels minor

  // Water: push blue channel slightly higher than bg
  const [wr, wg, wb] = parseHex(bg)
  const water = `#${Math.round(wr * 0.9).toString(16).padStart(2,'0')}${Math.round(wg * 1.1).toString(16).padStart(2,'0')}${Math.min(255, Math.round(wb * 1.6)).toString(16).padStart(2,'0')}`

  // Parks/greenery: push green channel
  const [pr, pg, pb] = parseHex(bg)
  const park = `#${Math.round(pr * 0.8).toString(16).padStart(2,'0')}${Math.min(255, Math.round(pg * 1.5 + 10)).toString(16).padStart(2,'0')}${Math.round(pb * 0.9).toString(16).padStart(2,'0')}`
  const wood = darken(park, 0.15)

  const casing = darken(bg, 0.2)   // road casings: darker than bg
  const halo   = darken(bg, 0.1)   // label halos

  return {
    background:              bg,
    earth:                   l1,
    park_a:                  park,
    park_b:                  darken(park, 0.08),
    hospital:                l2,
    industrial:              l1,
    school:                  l2,
    wood_a:                  wood,
    wood_b:                  darken(wood, 0.08),
    pedestrian:              l2,
    scrub_a:                 park,
    scrub_b:                 darken(park, 0.05),
    glacier:                 l2,
    sand:                    l2,
    beach:                   lighten(bg, 0.15),
    aerodrome:               l1,
    runway:                  l2,
    water,
    zoo:                     park,
    military:                l1,
    tunnel_other_casing:     casing,
    tunnel_minor_casing:     casing,
    tunnel_link_casing:      casing,
    tunnel_major_casing:     casing,
    tunnel_highway_casing:   casing,
    tunnel_other:            l2,
    tunnel_minor:            l2,
    tunnel_link:             l2,
    tunnel_major:            l3,
    tunnel_highway:          l4,
    pier:                    l3,
    buildings:               l3,
    minor_service_casing:    casing,
    minor_casing:            casing,
    link_casing:             casing,
    major_casing_late:       casing,
    highway_casing_late:     casing,
    other:                   l2,
    minor_service:           l2,
    minor_a:                 l3,
    minor_b:                 l2,
    link:                    l3,
    major_casing_early:      casing,
    major:                   l4,
    highway_casing_early:    casing,
    highway:                 l5,
    railway:                 casing,
    boundaries:              l4,
    waterway_label:          l6,
    bridges_other_casing:    casing,
    bridges_minor_casing:    casing,
    bridges_link_casing:     casing,
    bridges_major_casing:    casing,
    bridges_highway_casing:  casing,
    bridges_other:           l2,
    bridges_minor:           l3,
    bridges_link:            l3,
    bridges_major:           l4,
    bridges_highway:         l5,
    roads_label_minor:       l7,
    roads_label_minor_halo:  halo,
    roads_label_major:       l6,
    roads_label_major_halo:  halo,
    ocean_label:             l6,
    peak_label:              l6,
    subplace_label:          l7,
    subplace_label_halo:     halo,
    city_label:              l6,
    city_label_halo:         halo,
    state_label:             l4,
    state_label_halo:        halo,
    country_label:           l7,
    address_label:           l7,
    address_label_halo:      halo,
    pois:                    namedTheme('dark').pois,
    landcover: {
      grassland:  `rgba(${parseHex(park).join(',')}, 0.7)`,
      barren:     `rgba(${parseHex(l1).join(',')}, 0.8)`,
      urban_area: `rgba(${parseHex(l1).join(',')}, 0.6)`,
      farmland:   `rgba(${parseHex(park).join(',')}, 0.5)`,
      glacier:    `rgba(${parseHex(l2).join(',')}, 0.9)`,
      scrub:      `rgba(${parseHex(park).join(',')}, 0.6)`,
      forest:     `rgba(${parseHex(wood).join(',')}, 0.8)`,
    },
  }
}

function buildStyle(isLight: boolean): StyleSpecification {
  return {
    version: 8,
    glyphs:  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite:  `https://protomaps.github.io/basemaps-assets/sprites/v4/${isLight ? 'light' : 'dark'}`,
    sources: {
      protomaps: {
        type:        'vector',
        tiles:       [`https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${KEY}`],
        maxzoom:     15,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', buildTheme(isLight), { lang: 'en' }),
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function createCloverMarkerEl(leafCount: number, findId: string, color: string): HTMLElement {
  const size = 32
  const d = cloverPath(leafCount)
  const rotation = markerRotation(findId, 0)
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.style.overflow = 'visible'
  svg.style.opacity = '0.9'
  const g = document.createElementNS(ns, 'g')
  g.setAttribute('transform', `rotate(${rotation}, 50, 50)`)
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', color)
  g.appendChild(path)
  svg.appendChild(g)
  const el = document.createElement('div')
  el.style.cssText = `width:${size}px;height:${size}px;`
  el.appendChild(svg)
  return el
}

export function FindMap({ lat, lng, leafCount, findId, theme, isApproximate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<Map | null>(null)
  const markerRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    import('maplibre-gl').then((mod) => {
      if (cancelled || !containerRef.current) return

      const { Map, Marker, NavigationControl } = mod
      // Required for Next.js / Turbopack — worker can't resolve its own URL in node_modules
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mod.default as any).workerUrl = '/maplibre-gl-csp-worker.js'

      const isLight     = theme === 'light'
      const accentColor = cssVar('--color-accent')

      const map = new Map({
        container:          containerRef.current,
        style:              buildStyle(isLight),   // reads CSS vars fresh each time
        center:             [lng, lat],
        zoom:               isApproximate ? 11 : 16,
        attributionControl: false,
        scrollZoom:         false,
      })

      mapRef.current = map
      // Registering an 'error' listener stops maplibre's default console logging. Removing
      // a still-loading map (carousel navigation / close) aborts its in-flight tile/glyph
      // requests, which Safari surfaces as a "Load failed" console error — swallow those
      // benign aborts here while still surfacing anything unexpected.
      map.on('error', (e) => {
        const msg = (e as { error?: { message?: string } })?.error?.message ?? ''
        if (/abort|load failed|signal|cancel|null|undefined/i.test(msg)) return
        console.error('[map]', (e as { error?: unknown })?.error ?? e)
      })
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

      map.on('load', () => {
        if (cancelled) return

        if (isApproximate) {
          map.addSource('approx-circle', { type: 'geojson', data: circlePolygon(lng, lat, 3000) })
          map.addLayer({
            id: 'approx-circle-fill',
            type: 'fill',
            source: 'approx-circle',
            paint: { 'fill-color': accentColor, 'fill-opacity': 0.10 },
          })
          map.addLayer({
            id: 'approx-circle-border',
            type: 'line',
            source: 'approx-circle',
            paint: { 'line-color': accentColor, 'line-opacity': 0.5, 'line-width': 1.5 },
          })
        }

        const markerEl = leafCount && findId
          ? createCloverMarkerEl(leafCount, findId, accentColor)
          : undefined
        markerRef.current = new Marker({ element: markerEl, color: markerEl ? undefined : accentColor, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)
      })
    })

    return () => {
      cancelled = true
      markerRef.current?.remove()
      try { mapRef.current?.remove() } catch { /* aborted during load */ }
      mapRef.current = null
      markerRef.current = null
    }
  }, [lat, lng, theme, isApproximate])

  return <div ref={containerRef} className="w-full h-full" style={{ minHeight: '10rem' }} />
}
