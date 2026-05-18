import Link from "next/link";
import { signOut } from "@/app/actions/auth";

interface SiteHeaderProps {
  user: { id: string } | null;
}

export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-[680px] w-full px-4 sm:px-6 flex items-center justify-between h-12">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-text-primary"
        >
          Fourag
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <Link
              href="/account/finds/new"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Log a find
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/auth/sign-in"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
