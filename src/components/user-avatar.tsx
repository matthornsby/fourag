export function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  let hue = Math.round((Math.abs(hash) % 360) / 10) * 10;
  if (hue >= 70 && hue <= 90) hue = 81;
  return `hsl(${hue}, 100%, 64%)`;
}

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  fallback?: React.ReactNode;
  size?: string;
  style?: React.CSSProperties;
}

export function UserAvatar({ username, avatarUrl, fallback, size = "w-20 h-20", style }: UserAvatarProps) {
  return (
    <div
      className={`${size} rounded-full overflow-hidden shrink-0 flex items-center justify-center text-3xl text-serif`}
      style={{ '--avatar-color': avatarColor(username), background: 'var(--avatar-color)', color: 'var(--color-background)', fontWeight: '400', ...style } as React.CSSProperties}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
        : (fallback ?? username[0].toUpperCase())}
    </div>
    
  );
}
