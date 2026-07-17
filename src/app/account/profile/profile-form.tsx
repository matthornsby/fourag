'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { updateProfile, deleteAccount } from '@/app/actions/profile'
import type { UserProfile, PronounPreference } from '@/types'

type ProfileState = { ok: true } | { ok: false; error: string } | null

interface ProfileFormProps {
  profile: UserProfile
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, action, isPending] = useActionState<ProfileState, FormData>(updateProfile, null)
  const [, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarDragCounterRef = useRef(0)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isAvatarDragOver, setIsAvatarDragOver] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()

  function handleDelete() {
    setDeleteError(null)
    startDelete(async () => {
      const res = await deleteAccount()
      if (res && !res.ok) setDeleteError(res.error)
    })
  }

  const inputClass =
    'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'

  const initials = profile.username.slice(0, 2).toUpperCase()

  function resizeImage(file: File, size: number): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file),
          'image/jpeg',
          0.9
        )
      }
      img.src = url
    })
  }

  function processAvatarFile(file: File) {
    setAvatarPreview(URL.createObjectURL(file))
    resizeImage(file, 256).then(setAvatarFile)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processAvatarFile(file)
  }

  // Dragenter/dragleave fire on every child as the pointer moves over them, so a
  // plain boolean flickers; a counter keeps isAvatarDragOver true until the pointer
  // has actually left every nested element.
  function handleAvatarDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    avatarDragCounterRef.current += 1
    setIsAvatarDragOver(true)
  }

  function handleAvatarDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleAvatarDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    avatarDragCounterRef.current = Math.max(0, avatarDragCounterRef.current - 1)
    if (avatarDragCounterRef.current === 0) setIsAvatarDragOver(false)
  }

  function handleAvatarDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    avatarDragCounterRef.current = 0
    setIsAvatarDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) processAvatarFile(file)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (avatarFile) {
      formData.set('avatarFile', avatarFile)
    }
    startTransition(() => action(formData))
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Avatar */}
      <div className="flex flex-col gap-2">
        <span className={labelClass}>Photo</span>
        <div
          className="flex items-center gap-4"
          onDragEnter={handleAvatarDragEnter}
          onDragOver={handleAvatarDragOver}
          onDragLeave={handleAvatarDragLeave}
          onDrop={handleAvatarDrop}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={[
              'relative shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-accent',
              isAvatarDragOver ? 'border-accent ring-2 ring-accent/40' : 'border-border hover:border-accent',
            ].join(' ')}
            aria-label="Change profile photo"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="flex items-center justify-center w-full h-full bg-surface text-text-secondary text-sm font-medium">
                {initials}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors duration-150"
          >
            {avatarPreview ? 'Change photo' : 'Add photo'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/heic"
          className="sr-only"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Username — read-only */}
      <div>
        <label htmlFor="username" className={labelClass}>Username</label>
        <input
          id="username"
          type="text"
          value={profile.username}
          readOnly
          className={`${inputClass} opacity-50 cursor-default`}
        />
      </div>

      {/* Pronouns */}
      <div>
        <span className={labelClass}>Pronouns</span>
        <select
          name="pronouns"
          defaultValue={profile.pronouns ?? 'neutral'}
          className={inputClass}
        >
          <option value="neutral">Neutral (They/Their)</option>
          <option value="masculine">Masculine (He/His)</option>
          <option value="feminine">Feminine (She/Her)</option>
          <option value="none">None</option>
        </select>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className={labelClass}>Bio</label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={200}
          defaultValue={profile.bio ?? ''}
          placeholder="A short note about yourself"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* URL — admin only, for now, to keep it spam-free */}
      {profile.is_admin && (
        <div>
          <label htmlFor="profileUrl" className={labelClass}>URL</label>
          <input
            id="profileUrl"
            name="profileUrl"
            type="url"
            maxLength={300}
            defaultValue={profile.profile_url ?? ''}
            placeholder="https://example.com"
            className={inputClass}
          />
        </div>
      )}

      {state && !state.ok && (
        <p role="alert" className="text-sm text-error rounded-md bg-red-50 border border-red-200 px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-accent">Saved.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full button button-primary"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>

    </form>

    {/* Delete account */}
    <div className="border-t border-border mt-10 pt-6">
      <h2 className="text-sm font-medium text-text-primary mb-1">Delete account</h2>
      <p className="text-sm text-text-secondary mb-3">
        Permanently deletes your account, profile, and all of your finds. This can’t be undone.
      </p>
      {!confirmingDelete ? (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="inline-flex items-center rounded-md border border-error text-error text-sm font-medium px-4 py-2 hover:opacity-80 transition-opacity duration-150"
        >
          Delete account
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-primary">
            Are you sure? This permanently removes your account and everything you’ve shared.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center rounded-md bg-error text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {deleteError && (
        <p role="alert" className="text-sm text-error mt-2">{deleteError}</p>
      )}
    </div>
    </>
  )
}
