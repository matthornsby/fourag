import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { FindForm } from '@/components/find-form'

export default async function NewFindPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="flex-1 px-4 py-8 sm:px-6">
      <div className="max-w-[680px] mx-auto flex flex-col gap-6">
        {!user && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">Already have an account?</p>
            <Link
              href="/auth/sign-in"
              className="shrink-0 text-sm font-medium text-accent hover:underline underline-offset-2"
            >
              Sign in
            </Link>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Log a find</h1>
          <p className="text-sm text-text-secondary mb-8">
            Record a clover you&apos;ve found — photo, date, and leaf count.
          </p>
          <FindForm isAuthenticated={!!user} />
        </div>
      </div>
    </main>
  )
}
