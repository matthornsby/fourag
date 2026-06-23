'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SHARE_A_FIND } from '@/lib/constants'

export function ShareFindLink() {
  const pathname = usePathname()
  const href =
    pathname && pathname !== '/account/finds/new'
      ? `/account/finds/new?returnTo=${encodeURIComponent(pathname)}`
      : '/account/finds/new'

  return (
    <Link href={href} className="button button-primary">
      {SHARE_A_FIND}
    </Link>
  )
}
