'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { PhotoUpload } from './photo-upload'
import { CloverFields } from './clover-fields'
import { createFind, updateFind, deleteFind, createAnonymousFind, createFindAndRequestAccount } from '@/app/actions/finds'
import { markerRotation } from '@/lib/marker-rotation'
import type { Find, Clover } from '@/types'

interface Annotation {
  x: number
  y: number
  radius?: number
  rotation?: number
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function formatCoords(lat: string, lng: string): string {
  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  const latDir = latNum >= 0 ? 'N' : 'S'
  const lngDir = lngNum >= 0 ? 'E' : 'W'
  return `${Math.abs(latNum).toFixed(5)}°${latDir} ${Math.abs(lngNum).toFixed(5)}°${lngDir}`
}

interface FindFormProps {
  find?: Find & { clovers: Clover[] }
  isAuthenticated?: boolean
  updateAction?: (findId: string, formData: FormData) => Promise<{ error: string } | never>
  returnTo?: string
}

export function FindForm({ find, isAuthenticated = true, updateAction, returnTo }: FindFormProps) {
  const isEdit = find !== undefined

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [foundAt, setFoundAt] = useState(
    find?.found_at ? toDatetimeLocalValue(new Date(find.found_at)) : ''
  )
  const [lat, setLat] = useState(find?.lat != null ? String(find.lat) : '')
  const [lng, setLng] = useState(find?.lng != null ? String(find.lng) : '')
  const [locationName, setLocationName] = useState(find?.location_name ?? '')
  const [lookingUp, setLookingUp] = useState(false)
  const [locationPrivacy, setLocationPrivacy] = useState<'public' | 'approximate' | 'private'>(
    find?.location_privacy ?? 'public'
  )
  const [notes, setNotes] = useState(find?.notes ?? '')
  const [leafCounts, setLeafCounts] = useState<number[]>(
    find && find.clovers.length > 0 ? find.clovers.map((c) => c.leaf_count) : [4]
  )
  const [annotations, setAnnotations] = useState<(Annotation | null)[]>(
    find && find.clovers.length > 0
      ? find.clovers.map((c, i) =>
          c.annotation_x != null && c.annotation_y != null
            ? {
                x: c.annotation_x,
                y: c.annotation_y,
                radius: c.annotation_radius ?? undefined,
                rotation: c.annotation_rotation ?? markerRotation(find.id, i),
              }
            : null
        )
      : [null]
  )
  const [activeCloverIndex, setActiveCloverIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'find' | 'account'>('find')
  const [accountUsername, setAccountUsername] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')

  function geocode(latVal: string, lngVal: string, privacy: string) {
    setLookingUp(true)
    setLocationName('')
    fetch(`/api/geocode?lat=${encodeURIComponent(latVal)}&lng=${encodeURIComponent(lngVal)}&privacy=${encodeURIComponent(privacy)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.name) setLocationName(data.name) })
      .finally(() => setLookingUp(false))
  }

  useEffect(() => {
    if (lat && lng && !locationName) geocode(lat, lng, locationPrivacy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  function handlePhotoChange(
    file: File,
    exifData: { lat?: number; lng?: number; foundAt?: Date } | null
  ) {
    setPhotoFile(file)
    if (exifData?.foundAt) setFoundAt(toDatetimeLocalValue(exifData.foundAt))
    if (exifData?.lat != null && exifData?.lng != null) {
      setLocationName('')
      setLat(String(exifData.lat))
      setLng(String(exifData.lng))
    } else {
      setLat('')
      setLng('')
      setLocationName('')
    }
  }

  function handleLeafCountsChange(counts: number[]) {
    setAnnotations((prev) => counts.map((_, i) => prev[i] ?? null))
    setLeafCounts(counts)
  }

  function handleAnnotate(index: number, x: number, y: number) {
    setAnnotations((prev) => {
      const next = [...prev]
      next[index] = {
        x, y,
        radius: prev[index]?.radius,
        rotation: prev[index]?.rotation ?? markerRotation(find?.id ?? 0, index),
      }
      return next
    })
  }

  function handleRadiusChange(index: number, radius: number) {
    setAnnotations((prev) => {
      const next = [...prev]
      if (next[index]) next[index] = { ...next[index]!, radius }
      return next
    })
  }

  function handleRotationChange(index: number, rotation: number) {
    setAnnotations((prev) => {
      const next = [...prev]
      if (next[index]) next[index] = { ...next[index]!, rotation }
      return next
    })
  }

  function buildFindFormData() {
    const formData = new FormData()
    if (photoFile) formData.append('photoFile', photoFile)
    // Convert while `foundAt`'s local wall-clock fields still mean "the browser's
    // timezone" — the only place that's true. A naive "YYYY-MM-DDTHH:MM" string
    // sent as-is would get re-parsed by `new Date()` server-side using the
    // server process's own timezone (UTC in production), silently shifting the
    // stored instant by whatever the uploader's UTC offset happens to be.
    formData.append('found_at', new Date(foundAt).toISOString())
    if (lat) formData.append('lat', lat)
    if (lng) formData.append('lng', lng)
    if (locationName) formData.append('location_name', locationName)
    formData.append('location_privacy', locationPrivacy)
    if (notes) formData.append('notes', notes)
    formData.append('leaf_counts', JSON.stringify(leafCounts))
    formData.append('annotations', JSON.stringify(annotations))
    if (returnTo) formData.append('return_to', returnTo)
    return formData
  }

  const hasPhoto = isEdit ? true : !!photoFile
  const allAnnotated = annotations.every((a) => a !== null)
  const canSubmit = hasPhoto && allAnnotated

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (step === 'account') {
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(accountUsername)) {
        setError('Username must be 3–20 characters and contain only letters, numbers, hyphens, or underscores.')
        return
      }
      if (accountPassword.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      const formData = buildFindFormData()
      formData.append('username', accountUsername)
      formData.append('email', accountEmail)
      formData.append('password', accountPassword)
      startTransition(async () => {
        const result = await createFindAndRequestAccount(formData)
        if (result?.error) setError(result.error)
      })
      return
    }

    if (!isEdit && !photoFile) { setError('A photo is required.'); return }
    if (!foundAt) { setError('Date and time found is required.'); return }
    if (new Date(foundAt) > new Date()) { setError('Date found cannot be in the future.'); return }
    if (notes.length > 500) { setError('Notes must be 500 characters or fewer.'); return }

    if (!isAuthenticated) {
      startTransition(async () => {
        const result = await createAnonymousFind(buildFindFormData())
        if (result?.error) setError(result.error)
      })
      return
    }

    startTransition(async () => {
      const result = isEdit
        ? await (updateAction ?? updateFind)(find.id, buildFindFormData())
        : await createFind(buildFindFormData())
      if (result?.error) setError(result.error)
    })
  }

  function handleRequestAccount() {
    if (!isEdit && !photoFile) { setError('A photo is required.'); return }
    if (!foundAt) { setError('Date and time found is required.'); return }
    if (new Date(foundAt) > new Date()) { setError('Date found cannot be in the future.'); return }
    setError(null)
    setStep('account')
  }

  function handleDelete() {
    if (!window.confirm('Delete this find? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteFind(find!.id)
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
          leafCounts={leafCounts}
          markerSeed={find?.id}
          activeCloverIndex={activeCloverIndex}
          onAnnotate={handleAnnotate}
          onRadiusChange={handleRadiusChange}
          onRotationChange={handleRotationChange}
          onActivate={setActiveCloverIndex}
          initialPhotoUrl={find?.photo_url}
        />
      </div>

      {/* Clovers */}
      <div>
        <label className={labelClass}>Clovers</label>
        <CloverFields
          value={leafCounts}
          onChange={handleLeafCountsChange}
          activeIndex={activeCloverIndex}
          onActivate={setActiveCloverIndex}
          hasPhoto={!!photoFile || !!find?.photo_url}
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

      {/* Location — only shown when coordinates exist from EXIF */}
      {lat && lng && (
        <fieldset className="flex flex-col gap-3">
          <legend className={labelClass}>Location</legend>
          <p className="text-sm text-text-secondary">
            {lookingUp ? 'Looking up…' : locationName || ''}
            {!lookingUp && <span className="opacity-60"> ({formatCoords(lat, lng)})</span>}
          </p>
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
                    onChange={() => { setLocationPrivacy(value); if (lat && lng) geocode(lat, lng, value) }}
                    className="accent-accent"
                  />
                  <span className="text-sm font-medium text-text-primary">{label}</span>
                </div>
                <span className="text-xs text-text-secondary pl-5">{description}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

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
          maxLength={500}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Step 2: account details for unauthenticated "request account" path */}
      {step === 'account' && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface px-4 py-4">
          <p className="text-sm font-medium text-text-primary">Create your account</p>
          <div>
            <label htmlFor="account-username" className={labelClass}>Username</label>
            <input
              id="account-username"
              type="text"
              autoComplete="username"
              required
              value={accountUsername}
              onChange={(e) => setAccountUsername(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="account-email" className={labelClass}>Email</label>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              required
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="account-password" className={labelClass}>Password</label>
            <input
              id="account-password"
              type="password"
              autoComplete="new-password"
              required
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-error rounded-md bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      {/* Submit */}
      {step === 'account' ? (
        <>
          <button
            type="submit"
            disabled={isPending}
            className="w-full button button-primary"
          >
            {isPending ? 'Submitting…' : 'Submit find and request account'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('find'); setError(null) }}
            className="w-full text-sm text-center text-text-secondary hover:text-text-primary transition-colors duration-150"
          >
            Back
          </button>
        </>
      ) : !isAuthenticated ? (
        <>
          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="w-full button button-primary"
          >
            {isPending ? 'Submitting…' : 'Log anonymously'}
          </button>
          <button
            type="button"
            onClick={handleRequestAccount}
            disabled={isPending || !canSubmit}
            className="w-full button button-secondary"
          >
            Log and request an account
          </button>
          <Link
            href="/"
            className="w-full text-sm text-center text-text-secondary hover:text-text-primary transition-colors duration-150"
          >
            Cancel
          </Link>
        </>
      ) : (
        <>
          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="w-full button button-primary"
          >
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Share this find'}
          </button>
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="w-full text-sm text-text-secondary hover:text-error transition-colors duration-150 disabled:opacity-50"
            >
              Delete find
            </button>
          ) : (
            <Link
              href="/"
              className="w-full text-sm text-center text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Cancel
            </Link>
          )}
        </>
      )}
    </form>
  )
}
