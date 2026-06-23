'use client'

import { useEffect, useRef } from 'react'
import { layers, namedTheme } from 'protomaps-themes-base'
import type { Map, Marker, LngLatBoundsLike, StyleSpecification } from 'maplibre-gl'
import type { Find, Clover } from '@/types'
import { cloverPath } from '@/lib/clover-path'
import { markerRotation } from '@/lib/marker-rotation'

interface Props {
  finds: (Find & { clovers?: Clover[] })[]
}

function createCloverElement(leafCount: number, count: number, rotation: number, color: string): HTMLElement {
  const size = Math.round(28 + Math.min(Math.log2(count) * 5, 14))
  const d = cloverPath(leafCount)
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.style.overflow = 'visible'
  svg.style.opacity = '0.88'
  const g = document.createElementNS(ns, 'g')
  g.setAttribute('transform', `rotate(${rotation}, 50, 50)`)
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', color || 'green')
  g.appendChild(path)
  svg.appendChild(g)
  const el = document.createElement('div')
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`
  el.appendChild(svg)
  return el
}

const KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY!

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const mix = (c: number) => Math.round(Math.min(255, c + (255 - c) * factor))
  return `#${[r, g, b].map(mix).map(n => n.toString(16).padStart(2, '0')).join('')}`
}

function darken(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const mix = (c: number) => Math.round(c * (1 - factor))
  return `#${[r, g, b].map(mix).map(n => n.toString(16).padStart(2, '0')).join('')}`
}

function buildTheme(isLight: boolean) {
  const bg = cssVar('--color-background')

  if (isLight) {
    return { ...namedTheme('light'), background: bg }
  }

  const l1 = lighten(bg, 0.06)
  const l2 = lighten(bg, 0.12)
  const l3 = lighten(bg, 0.20)
  const l4 = lighten(bg, 0.30)
  const l5 = lighten(bg, 0.42)
  const l6 = lighten(bg, 0.55)
  const l7 = lighten(bg, 0.35)

  const [wr, wg, wb] = parseHex(bg)
  const water = `#${Math.round(wr * 0.9).toString(16).padStart(2,'0')}${Math.round(wg * 1.1).toString(16).padStart(2,'0')}${Math.min(255, Math.round(wb * 1.6)).toString(16).padStart(2,'0')}`
  const [pr, pg, pb] = parseHex(bg)
  const park = `#${Math.round(pr * 0.8).toString(16).padStart(2,'0')}${Math.min(255, Math.round(pg * 1.5 + 10)).toString(16).padStart(2,'0')}${Math.round(pb * 0.9).toString(16).padStart(2,'0')}`
  const wood = darken(park, 0.15)
  const casing = darken(bg, 0.2)
  const halo = darken(bg, 0.1)

  return {
    background: bg, earth: l1, park_a: park, park_b: darken(park, 0.08),
    hospital: l2, industrial: l1, school: l2, wood_a: wood, wood_b: darken(wood, 0.08),
    pedestrian: l2, scrub_a: park, scrub_b: darken(park, 0.05), glacier: l2,
    sand: l2, beach: lighten(bg, 0.15), aerodrome: l1, runway: l2, water,
    zoo: park, military: l1,
    tunnel_other_casing: casing, tunnel_minor_casing: casing, tunnel_link_casing: casing,
    tunnel_major_casing: casing, tunnel_highway_casing: casing,
    tunnel_other: l2, tunnel_minor: l2, tunnel_link: l2, tunnel_major: l3, tunnel_highway: l4,
    pier: l3, buildings: l3,
    minor_service_casing: casing, minor_casing: casing, link_casing: casing,
    major_casing_late: casing, highway_casing_late: casing,
    other: l2, minor_service: l2, minor_a: l3, minor_b: l2, link: l3,
    major_casing_early: casing, major: l4, highway_casing_early: casing, highway: l5,
    railway: casing, boundaries: l4, waterway_label: l6,
    bridges_other_casing: casing, bridges_minor_casing: casing, bridges_link_casing: casing,
    bridges_major_casing: casing, bridges_highway_casing: casing,
    bridges_other: l2, bridges_minor: l3, bridges_link: l3, bridges_major: l4, bridges_highway: l5,
    roads_label_minor: l7, roads_label_minor_halo: halo,
    roads_label_major: l6, roads_label_major_halo: halo,
    ocean_label: l6, peak_label: l6, subplace_label: l7, subplace_label_halo: halo,
    city_label: l6, city_label_halo: halo, state_label: l4, state_label_halo: halo,
    country_label: l7, address_label: l7, address_label_halo: halo,
    pois: namedTheme('dark').pois,
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
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${isLight ? 'light' : 'dark'}`,
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [`https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${KEY}`],
        maxzoom: 15,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', buildTheme(isLight), { lang: 'en' }),
  }
}

export function HomepageMap({ finds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)

  useEffect(() => {
    const points = finds.filter(f => f.lat !== null && f.lng !== null)
    if (!containerRef.current || points.length === 0) return
    let cancelled = false

    import('maplibre-gl').then((mod) => {
      if (cancelled || !containerRef.current) return

      const { Map, Marker, NavigationControl } = mod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mod.default as any).workerUrl = '/maplibre-gl-csp-worker.js'

      const accentColor = cssVar('--color-accent')

      const lats = points.map(f => f.lat!)
      const lngs = points.map(f => f.lng!)
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length

      const map = new Map({
        container: containerRef.current!,
        style: buildStyle(false),
        center: [centerLng, centerLat],
        zoom: 10,
        minZoom: 5,
        attributionControl: false,
        scrollZoom: false,
      })

      mapRef.current = map
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

      const markers: Marker[] = []

      map.on('load', () => {
        if (cancelled) return

        // Group finds by coordinate, tracking max leaf count and total count per pin
        const groups: Record<string, { lat: number; lng: number; maxLeaf: number; count: number }> = {}
        points.forEach(find => {
          const key = `${find.lat!.toFixed(6)},${find.lng!.toFixed(6)}`
          const maxLeaf = (find.clovers ?? []).reduce((m, c) => Math.max(m, c.leaf_count), 4)
          if (groups[key]) {
            groups[key].count++
            groups[key].maxLeaf = Math.max(groups[key].maxLeaf, maxLeaf)
          } else {
            groups[key] = { lat: find.lat!, lng: find.lng!, maxLeaf, count: 1 }
          }
        })

        if (Object.keys(groups).length > 1) {
          const groupLats = Object.values(groups).map(g => g.lat)
          const groupLngs = Object.values(groups).map(g => g.lng)
          const bounds: LngLatBoundsLike = [
            [Math.min(...groupLngs), Math.min(...groupLats)],
            [Math.max(...groupLngs), Math.max(...groupLats)],
          ]
          map.fitBounds(bounds, { padding: 80, maxZoom: 20 })
        }

        Object.entries(groups).forEach(([key, { lat, lng, maxLeaf, count }]) => {
          const rotation = markerRotation(key, 0)
          const el = createCloverElement(maxLeaf, count, rotation, accentColor)
          const marker = new Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map)
          markers.push(marker)
        })

      })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [finds])

  return <div ref={containerRef} className="w-full h-full" />
}
