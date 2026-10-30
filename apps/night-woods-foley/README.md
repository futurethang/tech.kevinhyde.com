# Night Woods Foley

A ten-pad sound board for running a scene at the table. Hit a cue and the whole
screen answers it: the clip plays and a screen-wide effect fires with it.

## Usage

Open `index.html` in a browser, or visit the deployed URL. All ten pads are
armed on arrival — the clips ship with the app.

Keys `1`–`9` and `0` fire the pads in order. `Space` stops everything.

## The pads

| Key | Cue | Mode | Screen |
| --- | --- | --- | --- |
| 1 | Owl call | one-shot | Indigo moonwash, two amber blinks |
| 2 | Coyote | one-shot | Ochre horizon glow rising |
| 3 | Thunder | one-shot | White flicker with after-flashes under the roll |
| 4 | Footsteps | bed | Darkness closing from alternating sides, in step time |
| 5 | Growl | one-shot | Red vignette throbbing, console shake |
| 6 | Scuttling | bed | Specks skittering under a green cast |
| 7 | Babbling brook | bed | Teal caustics along the bottom |
| 8 | Wind & creaks | bed | Streaks drifting across, cold vignette |
| 9 | Ghostly wail | one-shot | Violet mist columns rising |
| 0 | Scream | one-shot | Crimson flash, collapsing vignette, hard shake |

Beds latch on and off and show a lit LED. One-shots fire and overlap freely.

## Features

- Ten recordings shipped with the app, in `audio/`, named after their cue
- Screen-wide visual effect per cue, drawn on one fixed canvas
- **Soften visuals** removes the shake and flicker and drops every effect to
  roughly a third strength. It starts on when the browser reports
  `prefers-reduced-motion`, because full-screen flicker is a photosensitivity
  trigger
- Swap in your own clips by dropping files on the rack, or on a single pad.
  They are held in IndexedDB per browser and override that pad only; clearing
  the rack restores the shipped clip
- A live voice count beside **Stop all**, so a stuck cue is visible

## Development

Static app, no build step. Edit the files directly:

- `index.html` — structure
- `styles.css` — styling
- `script.js` — audio engine, effects engine, clip storage
- `audio/<cue>.mp3` — one clip per pad, named by cue id

Playback is Web Audio: each clip is decoded once to an `AudioBuffer`, and every
press starts a fresh `AudioBufferSourceNode` through its own gain into a shared
bus. Stopping a voice drops its `loop` flag before calling `stop()`, and
**Stop all** also ducks the bus to silence, so a source that ignores `stop()`
still goes quiet.

**The AudioContext is built on the first press, never at load.** Page load only
*fetches* the clips; decoding waits, because decoding needs a context and a
context constructed outside a user gesture starts suspended under every
browser's autoplay policy — Chrome wakes it on the first gesture, Safari does
not reliably wake one born outside one. Keep it that way: anything that calls
`audio()` during load silently costs the board its sound on some browsers.

To add a cue, add an entry to `CUES` in `script.js` (id, name, key, cap colour,
whether it loops, and which effect it draws), add a `case` for that effect in
the draw loop, and drop `audio/<id>.mp3` alongside the others. The pad markup
is generated from that array.

## Credits

Clips recorded by dragon-studio, universfield, lazychillzone, debwong1951 and
the Freesound community.
