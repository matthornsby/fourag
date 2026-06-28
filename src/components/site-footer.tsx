import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { SHARE_A_FIND } from "@/lib/constants";

interface SiteFooterProps {
  user: { id: string; username: string; isAdmin?: boolean } | null;
}

export function SiteFooter({ user }: SiteFooterProps) {
  return (
    <footer id="site-footer">
      <div id="footer-content">
        <nav id="footer-nav">
        <ul className="flex gap-8 text-xs">
          <li>
          User Links
          <ul className="mt-1">
          <li><Link href="/account/finds/new" className="nav-link">{SHARE_A_FIND}</Link></li>
          {user ? (
            <>
              <li><Link href={`/${user.username.toLowerCase()}`} className="nav-link">{user.username}</Link></li>
              <li>
                <SignOutButton>Sign out</SignOutButton>
              </li>
            </>
          ) : (
            <li><Link href="/auth/sign-in" className="nav-link">Sign in</Link></li>
          )}
          </ul>
          </li>
          <li>Site Links
          <ul className="mt-1">
            <li><Link href="/about" className="nav-link">About</Link></li>
            <li><Link href="/privacy" className="nav-link">Privacy</Link></li>
            {user && user.isAdmin &&(
              <li>
                  <Link href="/admin" className="nav-link">Admin</Link>
              </li>
            )}
          </ul>
          </li>
        </ul>
        
          
          
        </nav>
      </div>
    </footer>
  );
}
