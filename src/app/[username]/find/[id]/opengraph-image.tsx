import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase-admin'
import { cloverPath } from '@/lib/clover-path'
import { markerRotation } from '@/lib/marker-rotation'

export const runtime = 'nodejs'
export const contentType = 'image/png'

interface PageProps {
  params: Promise<{ username: string; id: string }>
}

function readImageDimensions(buf: ArrayBuffer): { w: number; h: number } | null {
  const u8 = new Uint8Array(buf)
  // PNG: 8-byte sig, then IHDR: 4-len + 4-"IHDR" + 4-width + 4-height
  if (u8[0] === 0x89 && u8[1] === 0x50) {
    const view = new DataView(buf)
    return { w: view.getUint32(16), h: view.getUint32(20) }
  }
  // JPEG: scan for SOF markers (0xFF 0xC0–0xC3, 0xC5–0xC7, 0xC9–0xCB, 0xCD–0xCF)
  if (u8[0] === 0xFF && u8[1] === 0xD8) {
    const view = new DataView(buf)
    let i = 2
    while (i < u8.length - 8) {
      if (u8[i] !== 0xFF) break
      const marker = u8[i + 1]
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        return { w: view.getUint16(i + 7), h: view.getUint16(i + 5) }
      }
      i += 2 + view.getUint16(i + 2)
    }
  }
  return null
}

export default async function OgImage({ params }: PageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: find } = await supabase
    .from('finds')
    .select('photo_url, location_privacy, clovers(leaf_count, annotation_x, annotation_y, annotation_radius, annotation_rotation)')
    .eq('id', id)
    .single()

  if (!find?.photo_url || find.location_privacy === 'private') {
    const fallbackSize = { width: 1200, height: 630 }
    return new ImageResponse(
      <div style={{ width: 1200, height: 630, background: '#1a1a1a' }} />,
      fallbackSize,
    )
  }

  // Fetch photo to read natural dimensions
  const photoRes = await fetch(find.photo_url)
  const photoBuf = await photoRes.arrayBuffer()
  const dims = readImageDimensions(photoBuf)

  const W = 1200
  const H = dims ? Math.round(dims.h * W / dims.w) : 630
  const imageSize = { width: W, height: H }

  const clovers = (find.clovers ?? []) as {
    leaf_count: number
    annotation_x: number | null
    annotation_y: number | null
    annotation_radius: number | null
    annotation_rotation: number | null
  }[]

  const annotated = clovers
    .map((c, i) => ({ ...c, i }))
    .filter(c => c.annotation_x !== null && c.annotation_y !== null)

  // Pass the image as a data URL so ImageResponse doesn't re-fetch it
  const photoBase64 = Buffer.from(photoBuf).toString('base64')
  const mimeType = photoRes.headers.get('content-type') ?? 'image/jpeg'
  const photoDataUrl = `data:${mimeType};base64,${photoBase64}`

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          position: 'relative',
          display: 'flex',
          background: '#000',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoDataUrl}
          width={W}
          height={H}
          style={{ position: 'absolute', inset: 0 }}
          alt=""
        />

        {annotated.map((clover) => {
          const cx = clover.annotation_x! * W
          const cy = clover.annotation_y! * H
          const radius = (clover.annotation_radius ?? 0.09) * W
          const markerSize = radius * 2
          const rotation = clover.annotation_rotation ?? markerRotation(id, clover.i)
          const d = cloverPath(clover.leaf_count)

          return (
            <svg
              key={clover.i}
              width={markerSize}
              height={markerSize}
              viewBox="0 0 100 100"
              style={{
                position: 'absolute',
                left: cx - radius,
                top: cy - radius,
                overflow: 'visible',
                filter: 'drop-shadow(0px 1px 6px rgba(0,0,0,0.5))',
              }}
            >
              <g transform={`rotate(${rotation} 50 50)`}>
                <path d={d} fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round" />
              </g>
            </svg>
          )
        })}
      </div>
    ),
    imageSize,
  )
}
