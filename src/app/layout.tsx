import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HashRedirect } from "@/components/hash-redirect";
import { createClient } from "@/lib/supabase-server";
import { isAdminUsername } from "@/lib/constants";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["wght", "SOFT", "opsz"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const username = user?.user_metadata?.username as string | undefined;
  const isAdmin = isAdminUsername(username);

  let avatarUrl: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=JSON.parse(localStorage.getItem('fourag-prefs')||'{}'),e=document.documentElement;e.dataset.orientation=p.orientation||'right-handed';if(p.theme==='light')e.dataset.theme='light';}catch(x){document.documentElement.dataset.orientation='right-handed';}})();` }} />
        <div id="wallpaper" aria-hidden="true" />
        <HashRedirect />
        <SiteHeader user={user && username ? { id: user.id, username, isAdmin, avatarUrl } : null} />
        {children}
        <SiteFooter user={user && username ? { id: user.id, username, isAdmin } : null} />
      </body>
    </html>
  );
}
