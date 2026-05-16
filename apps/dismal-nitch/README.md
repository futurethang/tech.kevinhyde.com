# Dismal Nitch — Studio Landing Page

Public-facing landing site for **Dismal Nitch**, a small recording studio in Ballard, WA.

## What it covers

- Hero with parallax PNW background
- About / the space
- Services: tracking, mixing, mastering, engineering, production
- Parallax breaks between sections
- Gear list (mics, guitars/amps, keys, room & chain)
- "Listen" — placeholder track cards (ready for Bandcamp / SoundCloud embeds)
- Contact form (opens user's email client) + studio info

## Tech

- Static HTML/CSS/JS — no build step
- Google Fonts: Fraunces (display) + Inter (body)
- Vanilla JS parallax with `requestAnimationFrame`, `IntersectionObserver` for reveals
- Fully responsive, mobile-first; honors `prefers-reduced-motion`

## Replacing the placeholder images

The hero, parallax breaks, and about photos use [loremflickr.com](https://loremflickr.com) with
locked seeds so the images stay consistent between loads but are easy to swap.
Look for `https://loremflickr.com/...` URLs in `index.html` and replace with real
studio photos when ready.

## Wiring up real audio

Each `.track` card in `index.html` is a styled placeholder. To wire a real
preview, replace the `<button class="track__play">` with a Bandcamp or
SoundCloud `<iframe>` embed, or swap in an `<audio>` element.

## Contact form

The form currently does a `mailto:` handoff to `hello@dismalnitch.studio`.
For a real form backend, plug in Formspree, Basin, Netlify Forms or similar
in `script.js`.
