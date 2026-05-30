"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";

export default function SignInPage() {
  const [error, action, pending] = useActionState(signIn, null);

  const inputClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
  const labelClass = "block text-sm font-medium text-text-primary mb-1.5";

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text-primary">Sign in</h1>
        <form action={action} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </div>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-accent text-contrast text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-sm text-text-secondary text-center">
          <a href="/auth/forgot-password" className="text-accent hover:underline underline-offset-2">Forgot password?</a>
        </p>
        <p className="text-sm text-text-secondary text-center">
          Don&apos;t have an account?{" "}
          <a href="/account/finds/new" className="text-accent hover:underline underline-offset-2">Log a find to get started.</a>
        </p>
      </div>
    </main>
  );
}
