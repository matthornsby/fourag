"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";

export default function SignInPage() {
  const [error, action, pending] = useActionState(signIn, null);

  return (
    <main>
      <h1>Sign in</h1>
      <form action={action}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p>
        Don&apos;t have an account? <a href="/auth/sign-up">Sign up</a>
      </p>
    </main>
  );
}
