"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export async function signUp(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return error.message;
  }

  // If a session was returned, email confirmation is disabled — go straight in.
  // Otherwise, direct the user to check their email.
  redirect(data.session ? "/" : "/auth/confirm");
}

export async function signIn(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return error.message;
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
