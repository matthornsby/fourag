"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";

export default function SignUpPage() {
  const [error, action, pending] = useActionState(signUp, null);

  return (
    <main>
      <h1>Create an account</h1>
      <form action={action}>
        <div>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
          />
        </div>
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
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p>
        Already have an account? <a href="/auth/sign-in">Sign in</a>
      </p>
    </main>
  );
}
