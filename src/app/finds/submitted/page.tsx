import Link from 'next/link'

export default function SubmittedPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Find submitted</h1>
        <p className="text-sm text-text-secondary">
          Thanks — your find is pending review and will appear once approved.
        </p>
        <Link
          href="/account/finds/new"
          className="text-sm text-accent hover:underline underline-offset-2"
        >
          Log another find
        </Link>
      </div>
    </main>
  )
}
