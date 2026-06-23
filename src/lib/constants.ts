export const FINDS_TERM = "finds";
export const SHARE_A_FIND = "Share a find";
export const SITE_TAGLINE = "Share Something Supernumerary";

export const ADMIN_USERNAMES = ['Matt', 'matthornsby'] as const;
export function isAdminUsername(username: string | undefined | null): boolean {
  return ADMIN_USERNAMES.includes(username as typeof ADMIN_USERNAMES[number]);
}
