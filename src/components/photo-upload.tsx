'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ImagePlus } from 'lucide-react'
import exifr from 'exifr'

interface ExifData {
  lat?: number
  lng?: number
  foundAt?: Date
}

interface Annotation {
  x: number
  y: number
}

interface PhotoUploadProps {
  onChange: (file: File, exifData: ExifData | null) => void
  annotations?: (Annotation | null)[]
  activeCloverIndex?: number
  onAnnotate?: (index: number, x: number, y: number) => void
  initialPhotoUrl?: string
}

export function PhotoUpload({
  onChange,
  annotations = [],
  activeCloverIndex = 0,
  onAnnotate,
  initialPhotoUrl,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  // Tracks whether the most recent mousedown-to-mouseup was a drag, so we
  // can suppress the click event that fires after mouseup on the container.
  const didDragRef = useRef(false)
  const [preview, setPreview] = useState<string | null>(initialPhotoUrl ?? null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))

    let exifData: ExifData | null = null
    try {
      const exif = await exifr.parse(file, { gps: true, pick: ['DateTimeOriginal'] })
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

    onChange(file, exifData)
  }

  function getNormalized(clientX: number, clientY: number) {
    // Use the image element directly — its rect is the exact rendered pixel area,
    // unaffected by any border or wrapper sizing.
    const el = imgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }

  // Global mouse move/up during drag
  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingIndex === null || !onAnnotate) return
      const pos = getNormalized(e.clientX, e.clientY)
      if (pos) onAnnotate(draggingIndex, pos.x, pos.y)
    },
    [draggingIndex, onAnnotate]
  )

  const handleGlobalMouseUp = useCallback(() => {
    didDragRef.current = true
    setDraggingIndex(null)
  }, [])

  useEffect(() => {
    if (draggingIndex === null) return
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggingIndex, handleGlobalMouseMove, handleGlobalMouseUp])

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    // Suppress clicks that are the tail of a drag gesture
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    if (!onAnnotate) return
    const pos = getNormalized(e.clientX, e.clientY)
    if (pos) onAnnotate(activeCloverIndex, pos.x, pos.y)
  }

  function handleDotMouseDown(e: React.MouseEvent, index: number) {
    e.stopPropagation() // prevent container click from firing
    e.preventDefault()
    didDragRef.current = false
    setDraggingIndex(index)
  }

  const isDragging = draggingIndex !== null

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
          <div className="flex justify-center">
            {/*
              `relative` anchors the overlay and dots to this element.
              `overflow-hidden` clips the rounded corners cleanly.
              No `inline-block` needed — the flex container handles centering,
              and the image's intrinsic size determines the wrapper width.
            */}
            <div className="relative rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={preview}
                alt="Selected photo preview"
                className="block max-h-[60vh] max-w-full w-auto h-auto"
                draggable={false}
              />

              {/*
                Overlay sits exactly over the image via `absolute inset-0`.
                Click coords are normalised against imgRef's bounding rect.
              */}
              <div
                className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                onClick={handleContainerClick}
              >
                {/* Annotation dots */}
                {annotations.map((ann, i) =>
                  ann ? (
                    <div
                      key={i}
                      onMouseDown={(e) => handleDotMouseDown(e, i)}
                      className={[
                        // Static structure — Tailwind classes
                        'absolute flex items-center justify-center rounded-full select-none',
                        'text-white font-semibold',
                        'shadow-[0_0_0_2px_white,0_1px_4px_rgba(0,0,0,0.3)]',
                        'transition-transform duration-150 ease-out',
                        isDragging && draggingIndex === i ? 'cursor-grabbing' : 'cursor-grab',
                      ].join(' ')}
                      style={{
                        // Dynamic values that can't be static Tailwind classes
                        left: `${ann.x * 100}%`,
                        top: `${ann.y * 100}%`,
                        width: 28,
                        height: 28,
                        fontSize: 11,
                        lineHeight: 1,
                        transform: `translate(-50%, -50%) ${
                          isDragging && draggingIndex === i ? 'scale(1.25)'
                          : i === activeCloverIndex ? 'scale(1.1)'
                          : 'scale(1)'
                        }`,
                        backgroundColor: isDragging && draggingIndex === i
                          ? 'var(--color-accent)'
                          : i === activeCloverIndex
                            ? 'var(--color-accent)'
                            : 'color-mix(in srgb, var(--color-accent) 70%, transparent)',
                      }}
                    >
                      {i + 1}
                    </div>
                  ) : null
                )}
              </div>
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
