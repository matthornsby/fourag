'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Pagination } from '@/components/pagination'
import { setUserAdmin, setUserTrusted } from '@/app/actions/admin'

const PAGE_SIZE = 20

export interface AdminUser {
  id: string
  username: string
  is_admin: boolean
  trusted: boolean
  created_at: string
}

interface Props {
  users: AdminUser[]
  currentUserId: string
}

// Buttons name the action, not the current state. Granting a privilege is a
// positive action (accent); revoking one is destructive (error).
function ActionButton({
  active,
  addLabel,
  removeLabel,
  disabled,
  onClick,
}: {
  active: boolean
  addLabel: string
  removeLabel: string
  disabled?: boolean
  onClick: () => void
}) {
  const removing = active
  const color = removing ? 'var(--color-error)' : 'var(--color-accent)'
  const bg = removing ? 'rgba(185,28,28,0.12)' : 'var(--color-accent-light)'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-xs font-medium px-3 py-1.5 rounded-md border transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
      style={{ color, borderColor: color, background: bg }}
    >
      {removing ? removeLabel : addLabel}
    </button>
  )
}

export function UsersPanel({ users: initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const filtered = users.filter((u) => {
    if (!search.trim()) return true
    return u.username.toLowerCase().includes(search.trim().toLowerCase())
  })

  // Reset to the first page whenever the search changes.
  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleAdmin(u: AdminUser) {
    setActionError(null)
    const next = !u.is_admin
    startTransition(async () => {
      const result = await setUserAdmin(u.id, next)
      if ('error' in result) {
        setActionError(result.error)
        return
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_admin: next } : x)))
    })
  }

  function toggleTrusted(u: AdminUser) {
    setActionError(null)
    const next = !u.trusted
    startTransition(async () => {
      const result = await setUserTrusted(u.id, next)
      if ('error' in result) {
        setActionError(result.error)
        return
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, trusted: next } : x)))
    })
  }

  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))

  return (
    <>
      <input
        type="search"
        placeholder="Search by username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md px-3 py-1.5 text-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--color-text-primary) 15%, transparent)',
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
      />

      {actionError && (
        <p className="text-sm" style={{ color: 'var(--color-error)' }}>{actionError}</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No users.
        </p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent)' }}
        >
          {paged.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: i > 0 ? '1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent)' : undefined,
                background: 'var(--color-surface)',
              }}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  {u.username ? (
                    <Link
                      href={`/${u.username.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate hover:underline cursor-pointer"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {u.username}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>—</span>
                  )}
                  {u.id === currentUserId && (
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>(you)</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    joined {fmt(u.created_at)}
                  </span>
                  {u.username && (
                    <Link
                      href={`/admin?q=${encodeURIComponent(u.username)}`}
                      className="text-xs font-medium hover:opacity-70 transition-opacity cursor-pointer"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      View finds →
                    </Link>
                  )}
                </div>
              </div>
              <ActionButton
                active={u.trusted}
                addLabel="Trust User"
                removeLabel="Remove Trust"
                disabled={isPending}
                onClick={() => toggleTrusted(u)}
              />
              <ActionButton
                active={u.is_admin}
                addLabel="Make Admin"
                removeLabel="Remove Admin"
                disabled={isPending || (u.id === currentUserId && u.is_admin)}
                onClick={() => toggleAdmin(u)}
              />
            </div>
          ))}
        </div>
      )}

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
    </>
  )
}
