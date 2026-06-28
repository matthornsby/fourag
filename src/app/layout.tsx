import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HashRedirect } from "@/components/hash-redirect";
import { createClient } from "@/lib/supabase-server";
import { PREFS_COOKIE, parsePrefs } from "@/lib/prefs";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fourag",
  description: "Fourag is a public patch for spreading the serendipity of four-leaf (or even more-leaf) clovers.",
};

// viewport-fit=cover lets full-bleed surfaces (wallpaper, header/footer, maps) reach
// the physical screen edge and exposes env(safe-area-inset-*) so content can inset
// past the notch / rounded corners in landscape. See safe-area rules in globals.css.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const prefs = parsePrefs(cookieStore.get(PREFS_COOKIE)?.value);
  const orientation = prefs.orientation === "left-handed" ? "left-handed" : "right-handed";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const username = user?.user_metadata?.username as string | undefined;

  const gaId =
    process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_GA_ID : undefined;

  let avatarUrl: string | null = null;
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('avatar_url, is_admin')
      .eq('id', user.id)
      .single();
    avatarUrl = profile?.avatar_url ?? null;
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-orientation={orientation}
      {...(prefs.theme === "light" ? { "data-theme": "light" } : {})}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <div id="wallpaper" aria-hidden="true" />
        <HashRedirect />
        <SiteHeader user={user && username ? { id: user.id, username, isAdmin, avatarUrl } : null} />
        {children}
        <SiteFooter user={user && username ? { id: user.id, username, isAdmin } : null} />
      </body>
      {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
    </html>
  );
}
