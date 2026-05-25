'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ImagePlus } from 'lucide-react'
import exifr from 'exifr'
import { CloverMarker } from './clover-marker'
import { markerRotation } from '@/lib/marker-rotation'

// Returns the image content area as fractions [0,1] of a square container.
// The container is always 1:1; the image is letterboxed inside it.
function contentArea(naturalRatio: number) {
  if (naturalRatio >= 1) {
    // Landscape: full width, bars top/bottom
    const h = 1 / naturalRatio
    return { left: 0, top: (1 - h) / 2, width: 1, height: h }
  } else {
    // Portrait: full height, bars left/right
    const w = naturalRatio
    return { left: (1 - w) / 2, top: 0, width: w, height: 1 }
  }
}

function resizeImage(file: File, maxDimension = 1920, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxDimension / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context unavailable')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('toBlob failed')); return }
          const name = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

interface ExifData {
  lat?: number
  lng?: number
  foundAt?: Date
}

interface Annotation {
  x: number
  y: number
  radius?: number
  rotation?: number
}

interface PhotoUploadProps {
  onChange: (file: File, exifData: ExifData | null) => void
  annotations?: (Annotation | null)[]
  leafCounts?: number[]
  markerSeed?: string | number
  activeCloverIndex?: number
  onAnnotate?: (index: number, x: number, y: number) => void
  onRadiusChange?: (index: number, radius: number) => void
  onRotationChange?: (index: number, rotation: number) => void
  onActivate?: (index: number) => void
  initialPhotoUrl?: string
}

export function PhotoUpload({
  onChange,
  annotations = [],
  leafCounts = [],
  markerSeed = 0,
  activeCloverIndex = 0,
  onAnnotate,
  onRadiusChange,
  onRotationChange,
  onActivate,
  initialPhotoUrl,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const didDragRef = useRef(false)
  const hasDragMovedRef = useRef(false)
  const latestAnnotationsRef = useRef(annotations)
  const [preview, setPreview] = useState<string | null>(initialPhotoUrl ?? null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [resizingIndex, setResizingIndex] = useState<number | null>(null)
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null)
  const rotationDragRef = useRef<{ lastAngle: number; rotation: number } | null>(null)
  // Natural aspect ratio of the loaded image; drives letterbox offset calculations.
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null)

  useEffect(() => { latestAnnotationsRef.current = annotations }, [annotations])

  function getRadiusFromPointer(clientX: number, clientY: number, index: number): number {
    const ann = latestAnnotationsRef.current[index]
    const el = imgRef.current
    if (!ann || !el) return 0.09
    const rect = el.getBoundingClientRect()
    const ratio = naturalRatio ?? (el.naturalWidth > 0 ? el.naturalWidth / el.naturalHeight : null)
    if (!ratio) return 0.09
    const ca = contentArea(ratio)
    const contentW = ca.width * rect.width
    if (contentW === 0) return 0.09
    const markerCX = rect.left + (ca.left + ann.x * ca.width) * rect.width
    const markerCY = rect.top + (ca.top + ann.y * ca.height) * rect.height
    const distPx = Math.sqrt((clientX - markerCX) ** 2 + (clientY - markerCY) ** 2)
    return Math.max(0.05, Math.min(0.35, distPx / contentW))
  }

  function getAngleFromPointer(clientX: number, clientY: number, index: number): number {
    const ann = latestAnnotationsRef.current[index]
    const el = imgRef.current
    if (!ann || !el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = naturalRatio ?? (el.naturalWidth > 0 ? el.naturalWidth / el.naturalHeight : null)
    if (!ratio) return 0
    const ca = contentArea(ratio)
    const markerCX = rect.left + (ca.left + ann.x * ca.width) * rect.width
    const markerCY = rect.top + (ca.top + ann.y * ca.height) * rect.height
    return Math.atan2(clientY - markerCY, clientX - markerCX) * 180 / Math.PI
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setNaturalRatio(null)

    let exifData: ExifData | null = null
    try {
      const exif = await exifr.parse(file, { gps: true })
      if (exif) {
        exifData = {
          lat: exif.latitude ?? undefined,
          lng: exif.longitude ?? undefined,
          foundAt: exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : undefined,
        }
      }
    } catch {
      // EXIF extraction failed — proceed without it
    }

    let uploadFile = file
    try {
      uploadFile = await resizeImage(file)
    } catch {
      // resize failed — upload original
    }

    onChange(uploadFile, exifData)
  }

  function handleImgLoad() {
    const el = imgRef.current
    if (el && el.naturalWidth > 0) {
      setNaturalRatio(el.naturalWidth / el.naturalHeight)
    }
  }

  // Normalise a pointer position to [0,1] within the image content area.
  // imgRef points to the img element which fills the square container (w-full h-full),
  // so its bounding rect equals the container rect.
  function getNormalized(clientX: number, clientY: number) {
    const el = imgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const ratio = naturalRatio ?? (el.naturalWidth > 0 ? el.naturalWidth / el.naturalHeight : null)
    if (!ratio) return null
    const ca = contentArea(ratio)
    const offsetX = ca.left * rect.width
    const offsetY = ca.top * rect.height
    const contentW = ca.width * rect.width
    const contentH = ca.height * rect.height
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left - offsetX) / contentW)),
      y: Math.max(0, Math.min(1, (clientY - rect.top - offsetY) / contentH)),
    }
  }

  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingIndex !== null && onAnnotate) {
        hasDragMovedRef.current = true
        const pos = getNormalized(e.clientX, e.clientY)
        if (pos) onAnnotate(draggingIndex, pos.x, pos.y)
      }
      if (resizingIndex !== null && onRadiusChange) {
        onRadiusChange(resizingIndex, getRadiusFromPointer(e.clientX, e.clientY, resizingIndex))
      }
      if (rotatingIndex !== null && onRotationChange && rotationDragRef.current) {
        const angle = getAngleFromPointer(e.clientX, e.clientY, rotatingIndex)
        let delta = angle - rotationDragRef.current.lastAngle
        if (delta > 180) delta -= 360
        if (delta < -180) delta += 360
        const newRotation = rotationDragRef.current.rotation + delta
        rotationDragRef.current = { lastAngle: angle, rotation: newRotation }
        onRotationChange(rotatingIndex, newRotation)
      }
    },
    [draggingIndex, resizingIndex, rotatingIndex, onAnnotate, onRadiusChange, onRotationChange, naturalRatio]
  )

  const handleGlobalMouseUp = useCallback(() => {
    const wasMarkerClick = draggingIndex !== null && !hasDragMovedRef.current
    didDragRef.current = draggingIndex !== null || resizingIndex !== null || rotatingIndex !== null
    rotationDragRef.current = null
    setDraggingIndex(null)
    setResizingIndex(null)
    setRotatingIndex(null)
    if (wasMarkerClick && onActivate) onActivate(draggingIndex!)
  }, [draggingIndex, resizingIndex, rotatingIndex, onActivate])

  useEffect(() => {
    if (draggingIndex === null && resizingIndex === null && rotatingIndex === null) return
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggingIndex, resizingIndex, rotatingIndex, handleGlobalMouseMove, handleGlobalMouseUp])

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    if (!onAnnotate) return
    const pos = getNormalized(e.clientX, e.clientY)
    if (pos) onAnnotate(activeCloverIndex, pos.x, pos.y)
  }

  function handleDotMouseDown(e: React.MouseEvent, index: number) {
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    hasDragMovedRef.current = false
    setDraggingIndex(index)
    if (onActivate) onActivate(index)
  }

  function handleResizeMouseDown(e: React.MouseEvent, index: number) {
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    setResizingIndex(index)
  }

  function handleRotateMouseDown(e: React.MouseEvent, index: number) {
    e.stopPropagation()
    e.preventDefault()
    didDragRef.current = false
    const ann = latestAnnotationsRef.current[index]
    const currentRotation = ann?.rotation ?? markerRotation(markerSeed, index)
    const angle = getAngleFromPointer(e.clientX, e.clientY, index)
    rotationDragRef.current = { lastAngle: angle, rotation: currentRotation }
    setRotatingIndex(index)
  }

  const isDragging = draggingIndex !== null
  const isResizing = resizingIndex !== null
  const isRotating = rotatingIndex !== null
  // Fall back to full-frame if image hasn't loaded yet
  const ca = naturalRatio ? contentArea(naturalRatio) : { left: 0, top: 0, width: 1, height: 1 }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed py-10',
            'border-border bg-background text-text-secondary',
            'hover:border-accent hover:text-accent hover:bg-accent-light',
            'transition-colors duration-150 cursor-pointer',
          ].join(' ')}
        >
          <ImagePlus size={24} strokeWidth={1.5} />
          <span className="text-sm font-medium">Choose a photo</span>
        </button>
      ) : (
        <>
          {/*
            Square frame: always as wide as the column, height matches.
            The img uses object-contain so the full image is visible;
            letterbox bars show the frame's white background.
            The frame is the positioning context for the overlay and markers.
          */}
          <div className="border border-border rounded-xl bg-surface w-full aspect-square relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={preview}
              alt="Selected photo preview"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
              onLoad={handleImgLoad}
            />

            <div
              className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : isResizing ? 'cursor-col-resize' : isRotating ? 'cursor-ew-resize' : 'cursor-crosshair'}`}
              onClick={handleContainerClick}
            >
              {annotations.map((ann, i) => {
                const rot = ann?.rotation ?? markerRotation(markerSeed, i)
                const radius = ann?.radius ?? 0.09
                const isActive = i === activeCloverIndex
                // Rotation handle sits at the rotated "top" of the marker so it follows orientation
                const rotRad = rot * Math.PI / 180
                const handleLeft = 50 + 50 * Math.sin(rotRad)
                const handleTop  = 50 - 50 * Math.cos(rotRad)
                return ann ? (
                  <div
                    key={i}
                    className="absolute select-none transition-transform duration-150 ease-out"
                    style={{
                      left: `${(ca.left + ann.x * ca.width) * 100}%`,
                      top: `${(ca.top + ann.y * ca.height) * 100}%`,
                      width: `${ca.width * radius * 200}%`,
                      aspectRatio: '1',
                      filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))',
                      transform: `translate(-50%, -50%) ${
                        isDragging && draggingIndex === i ? 'scale(1.1)'
                        : isActive ? 'scale(1.05)'
                        : 'scale(1)'
                      }`,
                      pointerEvents: 'none',
                    }}
                  >
                    <CloverMarker
                      leafCount={leafCounts[i] ?? 4}
                      label={String.fromCharCode(65 + i)}
                      rotation={rot}
                      active={isActive}
                      dragging={isDragging && draggingIndex === i}
                      onMouseDown={(e) => handleDotMouseDown(e, i)}
                    />
                    {isActive && (
                      <>
                        {/* Resize handle — fixed at 3 o'clock */}
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, i)}
                          className="absolute rounded-full border-2 border-white bg-accent/80 cursor-col-resize"
                          style={{
                            width: 12, height: 12,
                            right: 0, top: '50%',
                            transform: 'translate(50%, -50%)',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            pointerEvents: 'auto',
                          }}
                        />
                        {/* Rotation handle — follows the rotated top of the clover */}
                        <div
                          onMouseDown={(e) => handleRotateMouseDown(e, i)}
                          className="absolute rounded-full border-2 bg-white cursor-ew-resize"
                          style={{
                            width: 12, height: 12,
                            left: `${handleLeft}%`, top: `${handleTop}%`,
                            transform: 'translate(-50%, -50%)',
                            borderColor: 'var(--color-accent)',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            pointerEvents: 'auto',
                          }}
                        />
                      </>
                    )}
                  </div>
                ) : null
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="self-start text-sm text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors duration-150"
          >
            Replace photo
          </button>
        </>
      )}
    </div>
  )
}
