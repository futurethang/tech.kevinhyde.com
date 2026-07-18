# Drink Tracker

V2 of my alcohol unit tracker — a mobile-first PWA designed around one goal: making it more satisfying to drive your average down than it is to drink.

The original lived in the `neat-starter` repo as a calculator + tracker page pair. This rebuild keeps the data concepts (standard US units, `(oz × ABV%) ÷ 60`) and redesigns everything else for one-handed phone use.

## What's new in V2

- **Per-drink logging** — each drink is stored with type, fl oz, ABV%, and timestamp, then rolled up into daily unit totals. The old app stored one number per day.
- **Scroll-wheel entry** — fl oz and ABV% are picked on iOS-style scroll wheels instead of number inputs. The Beer / Wine / Liquor buttons are broad jumps for the ABV wheel only (~5% / ~12% / ~40%) so you land near the right strength and fine-tune from there; the oz wheel stays wherever you set it. The oz + ABV flow is the primary path since beers vary so much.
- **"Log again" chips** — your recent unique drinks are one tap to re-log.
- **Quantity stepper** — log ×N identical drinks in one go (stored as N entries so they stay individually deletable).
- **Backfill any date** — Today / Yesterday chips plus a native date picker, and every history day has an "+ Add drink to this day" action.
- **Reduction-focused rewards** — streak of days under your cap, zero-day counts, a personal-best lowest 7-day average that glows when you're at it, and a weekly unit budget. Nothing celebrates drinking; everything celebrates less.
- **Zero-day button** — logging an alcohol-free day is a first-class, one-tap action (untracked days are excluded from averages, so zero days must be claimed).
- **Configurable goals** — daily cap and weekly budget, adjustable as you ratchet down.
- **Vercel-style dark UI** — black/gray surfaces, monospace numerals, one accent color.

## Data & sync

No backend. Everything lives in `localStorage` as a single JSON document:

```json
{
  "version": 2,
  "settings": { "dailyGoal": 4, "weeklyGoal": 14 },
  "drinks": [{ "id": "…", "date": "2026-07-18", "ts": "…", "type": "beer", "oz": 12, "abv": 6.5, "units": 1.3 }],
  "afDays": ["2026-07-17"],
  "legacy": [{ "date": "2026-01-02", "units": 3, "note": "" }]
}
```

- **Export JSON file** → save to iCloud Drive via the Files app (the sync strategy)
- **Import JSON file** → merge or replace on another device
- **Clipboard copy/paste** → quick device-to-device transfer
- **V1 import** — pasting or importing the old format (a bare array of `{date, drinks, note}`) converts it to legacy day totals, so historical trends carry over

## Standard units

One US standard drink = 0.6 oz of pure alcohol:

| Drink | Units |
|---|---|
| 12 oz beer @ 5% | 1.0 |
| 5 oz wine @ 12% | 1.0 |
| 1.5 oz spirits @ 40% | 1.0 |

Formula: `(fl oz × ABV%) ÷ 60`

## Setup

No build step. Serve statically:

```bash
npx serve .
```

Installable as a PWA (add to home screen on iOS) and works offline via a network-first service worker.
