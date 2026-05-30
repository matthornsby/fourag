"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";

export default function SignUpPage() {
  const [error, action, pending] = useActionState(signUp, null);

  const inputClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
  const labelClass = "block text-sm font-medium text-text-primary mb-1.5";

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text-primary">Create an account</h1>
        <form action={action} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className={labelClass}>Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className={inputClass}
            />
          </div>
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
              autoComplete="new-password"
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
            {pending ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="text-sm text-text-secondary text-center">
          Already have an account?{" "}
          <a href="/auth/sign-in" className="text-accent hover:underline underline-offset-2">Sign in</a>
        </p>
      </div>
    </main>
  );
}
