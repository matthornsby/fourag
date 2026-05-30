# Fourag

Fourag is a public field journal for logging four-leaf (and more-leaf) clover finds. It's also a personal experiment in agentic design and development — most of the code was written collaboratively with Claude.

---

## What it does

- Log a find: upload a photo, record how many leaves, mark the clover's position on the photo, capture GPS coordinates and the time found
- Multiple clovers per find, each with its own leaf count and annotation marker
- Location privacy per find: exact, approximate (deterministically fuzzed), or hidden
- Luck indicator on the home page: exponential decay score based on days since last find
- Public find pages — others can view your finds subject to your privacy setting

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript, `src/` directory |
| Styling | Tailwind v4 — configured via `@theme` block in CSS, no config file |
| Backend / Auth / DB | Supabase (`@supabase/ssr`) |
| EXIF extraction | `exifr` (client-side) |
| Icons | Lucide React |
| Fonts | Geist Sans + Geist Mono |

**Next.js 16 notes:**
- Route protection lives in `src/proxy.ts` (named `proxy` export) — `middleware.ts` is deprecated in this version
- Read `node_modules/next/dist/docs/` before touching routing or middleware

**Supabase key naming (current convention):**
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — not `ANON_KEY`
- Email confirmation is disabled in the Supabase dashboard; `signUp` redirects to `/` directly when `data.session` is returned

---

## Local development

```bash
npm install
npm run dev
```

Requires a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Open [http://localhost:3000](http://localhost:3000).

---

## Design system

All tokens are defined in `src/app/globals.css` via Tailwind's `@theme`:

```
--color-background:     #F7F5F0   warm off-white
--color-surface:        #FFFFFF
--color-border:         #E2DDD6
--color-text-primary:   #1C1917
--color-text-secondary: #78716C
--color-accent:         #3D6B43   forest green
--color-accent-light:   #EBF2EC
--color-error:          #B91C1C
```

Single-column layout, `max-w-[680px]`, `px-4 sm:px-6`.

Use `color-mix(in srgb, var(--color-accent) 70%, transparent)` for opacity variants of custom tokens — Tailwind can't generate these automatically.

**Tailwind v4 gotcha:** class names must appear as complete strings in source for the scanner to pick them up. Use `isDragging ? 'cursor-grabbing' : 'cursor-crosshair'`, never `` `cursor-${x}` ``. Hot-reload can occasionally drop classes; a dev server restart fixes it.

---

## Database schema

```
public.users      id (→ auth.users), username, avatar_url, bio, created_at
public.finds      id, user_id, found_at, photo_url, lat, lng,
                  location_privacy ('public'|'approximate'|'private'),
                  notes, created_at
public.clovers    id, find_id, leaf_count (≥4), annotation_x, annotation_y,
                  annotation_radius (reserved, unused)
```

- RLS enabled on all tables; policies use `drop policy if exists …; create policy …` (no `create policy if not exists` in PostgreSQL)
- `public.users` is populated by a trigger on `auth.users` insert reading `raw_user_meta_data->>'username'`
- Photo storage: Supabase Storage bucket `finds` (public), path `{user_id}/{timestamp}-{random}.{ext}`

---

## File map

```
src/
├── proxy.ts                          Route protection + session refresh
├── types/index.ts                    Find, Clover, UserProfile, LocationPrivacy
├── lib/
│   ├── supabase.ts                   Browser client
│   └── supabase-server.ts            Async server client
├── app/
│   ├── globals.css                   Tailwind import + @theme tokens + body base
│   ├── layout.tsx                    Root layout — fetches user, renders SiteHeader
│   ├── page.tsx                      Home: finds timeline (auth) or landing (unauth)
│   ├── finds/[id]/page.tsx           Public find detail
│   ├── account/finds/new/page.tsx    Protected — create form
│   ├── account/finds/[id]/edit/      Protected — edit form
│   ├── actions/
│   │   ├── auth.ts                   signUp / signIn / signOut
│   │   └── finds.ts                  createFind / updateFind
│   └── auth/                         Sign-in, sign-up, callback, confirm, error pages
└── components/
    ├── site-header.tsx               Nav
    ├── find-card.tsx                 Timeline card
    ├── luck-indicator.tsx            Decay score pill
    ├── photo-upload.tsx              File input + EXIF + annotation overlay
    ├── clover-fields.tsx             Leaf count sliders
    ├── new-find-form.tsx             Create form (client)
    └── edit-find-form.tsx            Edit form (client)
```

---

## Key implementation notes

### Annotation system

Coordinates are normalised floats `[0.0, 1.0]` stored in `clovers.annotation_x/y`. The photo container pattern:

```
div.relative.rounded-lg.overflow-hidden.border    ← position: relative anchors dots
  img (block, max-h-[60vh], max-w-full)           ← imgRef for getBoundingClientRect()
  div.absolute.inset-0                            ← interaction overlay, exact image area
    dots (position absolute, left/top as %)
```

The overlay fills the container's content box (inside the border), which matches the image element's rendered area. `getNormalized()` measures `imgRef.getBoundingClientRect()` — click coordinates are always relative to the image, not the wrapper.

On the read-only find detail page the container uses `w-fit` (not `inline-block`) to reliably shrink to image width inside a `flex-col` layout. `inline-block` is overridden by flex item rules and can size wider than the image, causing dots to drift on window resize.

Drag support uses global `mousemove`/`mouseup` listeners managed in `useEffect`. A `didDragRef` flag suppresses the `click` event that fires after every mouseup, preventing accidental pin placement at the end of a drag.

### Location privacy

- `public` — exact coordinates stored and displayed
- `approximate` — deterministic fuzzy offset seeded by find ID: `((seed % 100) - 50) / 10000` degrees. Same offset every page load, different per find.
- `private` — coordinates stored but never exposed. Enforced in RLS policy and with a server-side redirect for non-owners.

### Luck indicator

`Math.round(100 * Math.exp(-daysSince / 12))`. Healthy ≥ 60 (accent green), fading 20–59 (amber `#B45309`), bare < 20 (text-secondary). Colour applied as inline `style={{ color }}` — the amber value has no design token.

### Server actions

`createFind` and `updateFind` in `src/app/actions/finds.ts`:

1. Validate auth and ownership
2. Upload photo to Supabase Storage
3. Upsert `finds` row
4. Delete + re-insert `clovers` rows
5. `redirect()` on success

`updateFind` skips the photo upload if `photoFile.size === 0` (no new file selected), keeping the existing URL. On replace it attempts to delete the old storage object — failure is non-fatal.

---

## Not yet built

- Leaf count shape — custom SVG per clover count (referenced in `design.md`, deferred)
- User profile pages
- Public discovery / browsing other users' finds
- Map view (coordinates are stored, nothing renders them)
- Delete find (RLS policy exists, no UI)
