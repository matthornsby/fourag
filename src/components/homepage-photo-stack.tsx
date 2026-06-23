'use client'

import { useState, useCallback } from 'react'
import { markerRotation } from '@/lib/marker-rotation'
import type { Find, Clover } from '@/types'

interface Props {
  finds: (Find & { clovers: Clover[] })[]
}

export function HomepagePhotoStack({ finds }: Props) {
  const [orientations, setOrientations] = useState<Record<string, 'landscape' | 'portrait'>>({})

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>, id: string) => {
    const img = e.currentTarget
    if (!img.naturalWidth) return
    const orientation = img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait'
    setOrientations(prev => prev[id] === orientation ? prev : { ...prev, [id]: orientation })
  }, [])

  // Oldest first so newest renders on top
  const stack = [...finds].reverse()

  return (
    <div className="relative w-full aspect-square">
      {stack.map((find, stackIdx) => {
        const rotation = markerRotation(find.id, 0) * 0.5
        const offsetX = markerRotation(find.id, 1) * 0.4
        const offsetY = markerRotation(find.id, 2) * 0.4
        const isLandscape = (orientations[find.id] ?? 'portrait') === 'landscape'

        return (
          <div
            key={find.id}
            className={`absolute overflow-hidden rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${
              isLandscape
                ? 'inset-x-0 top-1/2 aspect-[4/3]'
                : 'inset-y-0 left-1/2 aspect-[3/4]'
            }`}
            style={{
              zIndex: stackIdx + 1,
              transform: isLandscape
                ? `translateY(-50%) rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)`
                : `translateX(-50%) rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={find.photo_url}
              alt=""
              className="w-full h-full object-cover block"
              onLoad={e => handleLoad(e, find.id)}
              ref={el => {
                if (el?.complete && el.naturalWidth > 0) {
                  const orientation = el.naturalWidth > el.naturalHeight ? 'landscape' : 'portrait'
                  setOrientations(prev => prev[find.id] === orientation ? prev : { ...prev, [find.id]: orientation })
                }
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
