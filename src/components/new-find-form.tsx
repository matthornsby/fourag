'use client'

import { useState, useTransition } from 'react'
import { PhotoUpload } from './photo-upload'
import { CloverFields } from './clover-fields'
import { createFind } from '@/app/actions/finds'

interface Annotation {
  x: number
  y: number
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function NewFindForm() {
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [foundAt, setFoundAt] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [locationPrivacy, setLocationPrivacy] = useState<'public' | 'approximate' | 'private'>('public')
  const [notes, setNotes] = useState('')
  const [leafCounts, setLeafCounts] = useState<number[]>([4])
  const [annotations, setAnnotations] = useState<(Annotation | null)[]>([null])
  const [activeCloverIndex, setActiveCloverIndex] = useState(0)
  const [exifHadNoLocation, setExifHadNoLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePhotoChange(
    file: File,
    exifData: { lat?: number; lng?: number; foundAt?: Date } | null
  ) {
    setPhotoFile(file)
    if (exifData?.foundAt) setFoundAt(toDatetimeLocalValue(exifData.foundAt))
    if (exifData?.lat != null && exifData?.lng != null) {
      setLat(String(exifData.lat))
      setLng(String(exifData.lng))
      setExifHadNoLocation(false)
    } else {
      setLat('')
      setLng('')
      setExifHadNoLocation(true)
    }
  }

  function handleLeafCountsChange(counts: number[]) {
    // Keep annotations array in sync with clover count
    setAnnotations((prev) => {
      const next = counts.map((_, i) => prev[i] ?? null)
      return next
    })
    setLeafCounts(counts)
  }

  function handleAnnotate(index: number, x: number, y: number) {
    setAnnotations((prev) => {
      const next = [...prev]
      next[index] = { x, y }
      return next
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!photoFile) { setError('A photo is required.'); return }
    if (!foundAt) { setError('Date and time found is required.'); return }

    const formData = new FormData()
    formData.append('photoFile', photoFile)
    formData.append('found_at', foundAt)
    if (lat) formData.append('lat', lat)
    if (lng) formData.append('lng', lng)
    formData.append('location_privacy', locationPrivacy)
    if (notes) formData.append('notes', notes)
    formData.append('leaf_counts', JSON.stringify(leafCounts))
    formData.append('annotations', JSON.stringify(annotations))

    startTransition(async () => {
      const result = await createFind(formData)
      if (result?.error) setError(result.error)
    })
  }

  const inputClass =
    'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'

  const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'

  const privacyOptions = [
    { value: 'public', label: 'Public', description: 'Exact location visible to all' },
    { value: 'approximate', label: 'Approximate', description: 'General area only' },
    { value: 'private', label: 'Private', description: 'Location hidden' },
  ] as const

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Photo */}
      <div>
        <label className={labelClass}>Photo</label>
        <PhotoUpload
          onChange={handlePhotoChange}
          annotations={annotations}
          activeCloverIndex={activeCloverIndex}
          onAnnotate={handleAnnotate}
        />
      </div>

      {/* Clovers — directly below photo for easy annotation */}
      <div>
        <label className={labelClass}>Clovers</label>
        <CloverFields
          value={leafCounts}
          onChange={handleLeafCountsChange}
          activeIndex={activeCloverIndex}
          onActivate={setActiveCloverIndex}
          hasPhoto={!!photoFile}
        />
      </div>

      {/* Date & time */}
      <div>
        <label htmlFor="found_at" className={labelClass}>Date &amp; time found</label>
        <input
          id="found_at"
          type="datetime-local"
          required
          value={foundAt}
          onChange={(e) => setFoundAt(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Location */}
      <fieldset className="flex flex-col gap-3">
        <legend className={labelClass}>Location <span className="text-text-secondary font-normal">(optional)</span></legend>
        {exifHadNoLocation && (
          <p className="text-sm text-text-secondary">
            No location found in photo — enter manually or leave blank.
          </p>
        )}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="lat" className="block text-xs text-text-secondary mb-1">Latitude</label>
            <input
              id="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="e.g. 51.5074"
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="lng" className="block text-xs text-text-secondary mb-1">Longitude</label>
            <input
              id="lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="e.g. -0.1278"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* Location privacy */}
      <fieldset>
        <legend className={labelClass}>Location privacy</legend>
        <div className="flex gap-2">
          {privacyOptions.map(({ value, label, description }) => (
            <label
              key={value}
              className={[
                'flex-1 flex flex-col gap-0.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors duration-150',
                locationPrivacy === value
                  ? 'border-accent bg-accent-light'
                  : 'border-border bg-surface hover:border-accent/50',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="location_privacy"
                  value={value}
                  checked={locationPrivacy === value}
                  onChange={() => setLocationPrivacy(value)}
                  className="accent-accent"
                />
                <span className="text-sm font-medium text-text-primary">{label}</span>
              </div>
              <span className="text-xs text-text-secondary pl-5">{description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes <span className="text-text-secondary font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Where were you looking? What patch, what conditions?"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-error rounded-md bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-accent text-white text-sm font-medium px-4 py-2.5 hover:opacity-90 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Saving…' : 'Log find'}
      </button>
    </form>
  )
}
