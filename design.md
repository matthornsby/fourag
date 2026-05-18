# Fourag — Design Document

> A living reference for visual and interaction design decisions. Update this as decisions are made; code should follow what's here.

---

## Concept

Fourag documents the hunt for four-leaf (and rarer) clovers — a personal field journal made public. The tone is quiet and observational: this is a slow hobby, not a gamified app. The design should feel like a well-made nature notebook — considered, unhurried, a little tactile. Photos are the primary content; everything else serves them.

---

## Color

Working palette — to be refined once the logo is integrated.

| Token | Hex | Usage |
|---|---|---|
| `background` | `#F7F5F0` | Page background — warm off-white, like paper |
| `surface` | `#FFFFFF` | Cards, modals, inputs |
| `border` | `#E2DDD6` | Dividers, input borders |
| `text-primary` | `#1C1917` | Body copy, headings |
| `text-secondary` | `#78716C` | Labels, metadata, captions |
| `accent` | `#3D6B43` | Clover green — primary interactive colour |
| `accent-light` | `#EBF2EC` | Tints, hover states, badges |
| `error` | `#B91C1C` | Errors, destructive actions |

---

## Typography

To be confirmed once logo typeface is known. Working defaults:

- **Headings:** System serif stack (`Georgia, 'Times New Roman', serif`) — grounded, editorial
- **Body / UI:** System sans stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) — legible, neutral
- **Scale:** Base 16px. Use Tailwind's default type scale (sm, base, lg, xl, 2xl).
- **Weight:** 400 body, 500 labels, 600 headings

---

## Spacing & Layout

- **Max content width:** 680px (single-column, reading width)
- **Page padding:** 16px mobile, 24px tablet+
- **Grid:** Single column throughout — this is a journal, not a dashboard
- **Spacing scale:** Tailwind defaults (4px base unit)

---

## Iconography

Lucide Icons — lightweight, consistent stroke weight, good React support (`lucide-react`). Use 20px / `stroke-width-1.5` as default size.

---

## Components

### Find Card

Displays a single find in the gallery/timeline. Photo-first.

- Full-width photo (aspect ratio 4:3 or as captured)
- Below photo: date found, leaf count summary (e.g. "2 clovers · 4 + 5 leaves"), location privacy badge
- Tapping/clicking opens the full find view with annotations visible
- Owner sees edit affordance; others do not

### Clover Annotation

Circular overlay on photos marking each clover's position.

- Thin circle in `accent` colour with slight white inner glow for contrast on any background
- Numbered if multiple clovers in one photo
- On hover/tap: show leaf count for that clover
- Annotation placement UI: tap to place, drag to resize circle

### Leaf Count Shape *(to design)*

Rather than a plain number, the leaf count could be represented as a custom SVG shape — a stylised clover with the correct number of leaves (4, 5, 6, etc.). Used in annotation markers, find cards, and the clover fields UI. The shape should be recognisable at small sizes and work as a single accent-coloured glyph.

### Luck Indicator

Decaying score shown on the user's profile/timeline header.

- Starts at 100 after a find, decays toward 0 over ~30 days with a steep curve (fast decay early, slow at the end — logarithmic feel)
- Visual: a small clover icon that wilts or fades as luck decreases (three states: healthy / fading / bare)
- Not shown to other users visiting your profile

### Location Privacy Badge

Small inline badge on find cards and the full find view.

- `public` — no badge (default, assumed)
- `approximate` — subtle "~" prefix on location or a pin-with-circle icon
- `private` — lock icon, no map pin shown

---

## Motion & Interaction

- Prefer no motion by default; respect `prefers-reduced-motion`
- Transitions: 150ms ease-out for hovers, 200ms for modals/overlays
- Annotation circles: fade in on load (200ms), scale up on hover

---

## Voice & Tone

- Quiet and factual. "Found 17 May 2026" not "You found this today! 🎉"
- Empty states: gentle, not pushy. "No finds yet." not "Get out there and start looking!"
- Errors: plain and helpful. "Couldn't save your find — try again." not "Oops! Something went wrong 😬"
- Leaf counts are always numeric. "5-leaf clover" not "Five leaf clover"
