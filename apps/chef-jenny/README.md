# Chef Jenny

Personal brand website for Chef Jenny — a Seattle-based private chef and culinary instructor.

## Sections

1. **Hero** — Brand intro with CTAs to book a private experience or visit Duchess
2. **Meet Jenny** — Bio and personality chips
3. **Experiences** — Private chef bookings + cooking class options
4. **In the Kitchen** — Video recipe grid (4 placeholder cards)
5. **Duchess** — Brick-and-mortar storefront info + menu highlights
6. **Contact / Book** — Inquiry form with interest selector

## Design System

- **Colors:** Warm off-white · Electric lime `#B8F500` · Vivid magenta `#E8187A` · Deep plum `#3D0F26` · Forest green `#1A3A2A`
- **Fonts:** Bricolage Grotesque (display) · DM Sans (body) — loaded from Google Fonts
- **Accents:** Grain texture on dark sections, neon glow on CTA hover, organic SVG section dividers

## Features

- Sticky scroll-spy nav with active section highlight
- Mobile hamburger menu
- Animated hero marquee + scroll cue
- Pulsing lime play buttons on video cards
- Tweaks panel (bottom-right) for live palette/font/radius tuning
- Form validation + success state

## Assets Needed

Replace the striped placeholder panels with real photography:

| Slot | Description |
|------|-------------|
| `HERO_BG` | Jenny cooking — cinematic, candid, warm light |
| `JENNY_PORTRAIT` | Portrait, 3:4, apron or at the stove |
| `PRIVATE_DINNER_PHOTO` | Elegant candlelit table, Jenny plating |
| `CLASS_PHOTO` | Group cooking class, warm/chaotic energy |
| `VIDEO_01–04` | YouTube/Vimeo embed thumbnails |
| `MENU_ITEM_01–03` | Duchess food photography |

## Type

- Static HTML/CSS/JS — no build step
- All dependencies loaded from CDN (Google Fonts)
