# Jam Book

A personal song catalog and chord-chart reader for bluegrass, built for an iPad on a music stand.
No backing tracks, no play-along band — just charts, a metronome, and the one thing most chart apps
get half-right: **key and capo at the same time**.

## The key + capo idea

Most apps transpose *or* tell you where to put the capo. In a jam you need both at once, because the
key someone calls and the shapes you want to finger are two different questions.

Every chart is stored in the key it was written in. Two controls sit on top:

| Control | Meaning |
|---|---|
| **Sounding key** | What the band plays — what the room hears |
| **Capo** | Where your capo is clamped |
| **Play these shapes** | Derived: sounding key transposed *down* by the capo |

Someone calls Man of Constant Sorrow in B♭. Set the key to B♭, tap **Capo 3**, and the chart
redraws in G — the shapes your left hand actually makes — while the header keeps reminding you it
sounds in B♭.

The **Capo options** row does the search for you: for whatever key is called it lists every capo
position from 0 to 9 that lands on an open-position guitar key (G, C, D, A, E). Called in B♭ you get
`Open B♭ · Capo 1 A · Capo 3 G · Capo 6 E · Capo 8 D`. That row is the whole app in one line.

Four display modes: **Shapes** (default), **Sounding** (concert pitch), **Both** (shape large,
concert small — handy when you're calling changes to a fiddler), and **Numbers**
(Nashville number system, relative to the sounding key).

Each song remembers its own key and capo, so the tune you always capo 2 for stays that way.

## Chart format: ChordPro

Charts are plain text in [ChordPro](https://www.chordpro.org), the long-running open format for
chord charts (`.cho`, `.chopro`, `.chordpro`, `.crd`, `.pro`). Anything written here opens in other
ChordPro-aware apps, and their exports open here.

```
{title: Nine Pound Hammer}
{artist: Traditional}
{key: G}
{tempo: 120}
{tags: jam-standard, vocal}

{start_of_chorus}
[G]This nine pound hammer is a little too [C]heavy
[G]Buddy for my size, [D7]buddy for my [G]size
{end_of_chorus}
```

Supported directives (abbreviations in parentheses):

- **Metadata** — `{title:}` (`{t:}`), `{subtitle:}` (`{st:}`), `{artist:}`, `{composer:}`, `{album:}`, `{year:}`
- **Playing** — `{key:}` (the written key; without it the first chord is used), `{capo:}`, `{tempo:}` (feeds the metronome), `{time:}`
- **Tags** — `{tags: fiddle-tune, session-g}` or `{meta: tags …}`, which become the filter chips
- **Sections** — `{start_of_chorus}` (`{soc}`), `{start_of_verse}` (`{sov}`), `{start_of_bridge}` (`{sob}`) and their `{end_of_…}` partners; a label after the colon is printed
- **Repeats** — `{chorus}` prints a "repeat the chorus" marker
- **Notes** — `{comment:}` (`{c:}`), `{comment_box:}` (`{cb:}`)
- **Tab** — `{start_of_tab}` (`{sot}`), left exactly as typed
- **Grids** — `{start_of_grid}` (`{sog}`), transposed along with everything else
- **Layout** — `{column_break}` (`{colb}`), `{new_song}` (`{ns}`)

Unknown directives (`{define:}`, `{image:}`, …) are ignored rather than printed, so charts from other
apps import cleanly. Lines starting with `#` are comments.

### Bar grids

Fiddle tunes are mostly shape, not words. A dot holds the previous chord; bars never break across a
line even in a narrow column:

```
{start_of_grid: A part}
| A . . . | A . . . | A . . . | E . . . |
| A . . . | A . . . | E . . . | A . . . |
{end_of_grid}
```

### Pasting ordinary charts

Chords-above-lyrics, the way charts get passed around, is converted on import (or with
**Convert plain text** in the editor). Chords are spliced in at their column, and a chord that lands
a letter or two into a word snaps to the front of it:

```
G                 C
This nine pound hammer is a little too heavy
```

becomes `[G]This nine pound [C]hammer is a little too heavy`.

## Everything else

- **iPad-first layout** — song list beside the chart in landscape, a drawer in portrait; charts flow
  into two columns so a whole song fits without scrolling. Auto / 1 / 2 column switch, and A− / A+
  text sizing for reading at arm's length.
- **Light and dark** — dark by default, paper-light for bright rooms.
- **Metronome** — tap tempo, `{tempo:}` from the chart, 4/4 · 3/4 · 2/4 · 6/8, accented downbeat, and
  a backbeat-only mode for chop practice. Web Audio, scheduled ahead so it doesn't drift.
- **Search and filters** — title, artist, key, tags, plus favorites.
- **Keyboard** — `↑`/`↓` key, `←`/`→` capo, `space` metronome, `/` search.
- **Offline** — installable PWA with a network-first service worker.

## Data

Everything lives in `localStorage` under `jam-book-v1`. No account, no server.

```json
{
  "version": 1,
  "songs": [{ "id": "…", "source": "{title: …}…", "fav": false, "view": { "key": "Bb", "capo": 3 } }],
  "settings": { "theme": "dark", "mode": "shapes", "cols": "auto", "fontPx": 17, "bpm": 120 }
}
```

Import/export from the library menu:

- **Import files** — one or many `.cho` / `.chopro` / `.crd` / `.pro` / `.txt`, or a Jam Book `.json` backup
- **Export library (.json)** — full backup including each song's saved key and capo (save it to iCloud Drive and it opens on any device)
- **Export all as ChordPro (.cho)** — one standard file, songs separated by `{new_song}`
- **Export current song (.cho)**

## Starter songs

Ships with eleven traditional, public-domain tunes — Cripple Creek, Old Joe Clark, Angeline the
Baker, Soldier's Joy, Blackberry Blossom, Shady Grove, Little Maggie, Wildwood Flower, Will the
Circle Be Unbroken, Man of Constant Sorrow, Nine Pound Hammer — chosen to exercise the format:
grids, choruses, modal keys, minor keys. **Restore starter songs** in the library menu re-adds any
you've deleted.

## Setup

No build step.

```bash
npx serve .
```
