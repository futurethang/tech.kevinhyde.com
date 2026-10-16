# Image generation prompts — the board

Prompts for generating the printed trail map. Feed them to several models and
compare.

---

## Read this first: two passes, not one

Asking a model for "a trail map with 21 irregular zones overlaid that match the
terrain" will fail. It will give you a map with zone-ish blobs that sit on
nothing, or a zone diagram with decorative scribbles instead of terrain. The
two layers won't agree, which is exactly the problem you flagged.

**Generate the terrain first, with no zones at all. Then derive the zones from
the terrain you got.** That way the boundaries follow ridgelines and creeks
*because you drew them that way*, rather than hoping the model made them line
up. Pass 2 can be another model, or twenty minutes in Illustrator over the top.

**And generate it with no text whatsoever.** No model renders 22 legible place
names; you'll get beautiful gibberish and have to paint it out. Typeset every
label yourself afterwards.

### The geographic trick that makes the zones work

Frame the whole thing as **a single drainage basin — one watershed with one
road at its mouth.** That's genuinely funnel-shaped in nature: a broad upper
basin gathering water, two ridgelines converging downward, a canyon mouth where
the creek and the only road leave together.

Every theme then has a real place to live:

| Theme | Where it naturally sits in a watershed |
| --- | --- |
| Rock & Ruin | Upper headwalls, talus, an old quarry scar |
| Root & Rot | Shaded north-facing slopes, dense old growth |
| Fur & Feather | Sunny benches, meadows, brushy avalanche chutes |
| Rain & River | The creek corridor and its boggy flats |
| Grease & Gravel | Clearcut units and spur roads on the gentler benches |
| Forms & Procedures | The ranger station compound at the mouth |
| Dark & Distant | The deepest, shadiest pocket of the basin |

A forester would nod at that map. That's the bar — the zones can't look pasted
on if the ground underneath already justifies them.

---

## PASS 1 — the base map, no zones, no text

> A 1970s United States Forest Service recreation map of a single steep forested
> watershed, printed on folded paper. Vertical portrait sheet.
>
> The map shows one drainage basin: a broad timbered upper basin across the top
> that narrows downward between two converging ridgelines into a tight canyon
> mouth at the bottom edge, where a single gravel road leaves the map. One creek
> gathers tributaries across the upper basin and runs the full length of the
> valley to that mouth.
>
> Cartographic style: offset-printed flat spot colours on cream paper. Dark green
> woodland tint, pale green second growth, buff and white for open meadow and
> cut units, blue hydrography with fine stream lines and marsh symbols, brown
> contour lines at tight intervals across the steep ground, black dashed trails,
> red-brown logging spur roads switchbacking across the benches. Visible paper
> fold creases, slight foxing, faint offset misregistration, fine printing grain.
>
> Flat top-down orthographic cartography. No 3D, no perspective, no photorealism,
> no painterly landscape illustration.
>
> Terrain laid out so the basin reads as real country: bare rock, talus and an
> old quarry scar on the upper headwalls; dense old-growth timber on the shaded
> slopes; open meadows and brushy chutes on the sunny benches; a wide boggy flat
> where the creek braids in the upper basin; rectangular clearcut units with
> switchbacking spur roads on the middle benches; a burn scar of standing dead
> timber low in the valley; a small ranger station compound with outbuildings and
> a gravel turnaround at the canyon mouth beside the road.
>
> Absolutely no text, no labels, no place names, no legend, no title block, no
> compass rose, no grid numbers. Leave all lettering off the map entirely.

**Negative prompt** (where the model takes one):

> text, letters, words, labels, typography, legend, title block, watermark,
> signature, compass rose, 3D render, isometric, perspective view, photorealistic
> satellite imagery, fantasy map, parchment scroll, pirate map, video game UI,
> glossy, modern vector flat design

---

## PASS 2 — the zone overlay

Run this as an **edit / image-to-image pass on the Pass 1 result**, not from
scratch.

> Using this map as the base, add a translucent zone overlay dividing the valley
> into 21 irregular regions, in three tiers that narrow toward the canyon mouth:
> ten regions across the wide upper basin, seven across the middle, four in the
> lower canyon, and one highlighted region at the ranger station on the bottom
> edge.
>
> Every zone boundary must follow a feature already printed on the map — a
> ridgeline, a creek, a treeline, the edge of a cut unit, a contour break, a
> trail. No straight lines, no geometric cells, no hexagons, no grid. The
> boundaries should look hand-inked over the printed map by a ranger with a fine
> pen.
>
> Each zone carries a soft translucent wash of a single colour at roughly 25%
> opacity, so the contours, creeks and forest tint stay completely readable
> underneath. A thin dark hand-inked line around each zone. Zones tile with no
> gaps and no overlaps, and are roughly equal in area. Everything outside the two
> ridgelines is left unwashed and shaded darker as impassable ground.
>
> Still no text, no labels, no numbers anywhere.

### The much better version of Pass 2

You already have the exact zone geometry — `map-layout.svg` in this folder.
Rather than asking a model to invent 21 regions, feed that file in as a
structural reference:

- **Stable Diffusion / Flux with ControlNet**: use the SVG (exported as PNG
  line art) as a Canny or Scribble control image. The zones land exactly where
  the game says they are.
- **Models that accept a composition reference**: supply it as the layout image
  and the Pass 1 map as the style image.
- **Or just do it by hand.** Drop the Pass 1 map into Illustrator, put the SVG
  on top at low opacity, and redraw the 21 boundaries so each one snaps onto a
  ridge or a creek. Half an hour, and it's the only route that guarantees the
  two layers agree.

---

## PASS 3 (optional) — one-shot, as a lottery ticket

Worth one or two attempts in case a model surprises you. Expect the zones and
terrain to disagree.

> A 1970s US Forest Service recreation map of one steep forested watershed on
> folded cream paper, vertical portrait. A broad timbered basin at the top
> narrows between two converging ridgelines to a canyon mouth at the bottom edge
> where a gravel road leaves the map; one creek runs the length of the valley.
> Offset-printed flat spot colours, brown contour lines, blue streams, green
> forest tint, black dashed trails, red-brown spur roads, fold creases and
> printing grain.
>
> Overlaid on the map, hand-inked in fine pen: 21 irregular zones in three tiers
> that narrow downward, ten then seven then four, plus one at the ranger station
> at the mouth. Each zone a different soft translucent colour wash at low
> opacity, boundaries following ridgelines, creeks and treelines, never straight
> or geometric. Ground outside the ridgelines shaded dark as impassable.
>
> No text, no labels, no legend, no compass rose, no numbers.

---

## Model-by-model notes

| Model | What to change |
| --- | --- |
| **Midjourney** | Add `--ar 4:5 --style raw --s 50`. Low stylize keeps it documentary rather than decorative. Put the negatives in `--no text, letters, words, labels, legend, compass`. Use `--sref` with a real Forest Service map scan to lock the printing style |
| **GPT-Image / DALL·E** | Best at actually obeying "no text" and at the Pass 2 edit. Give it the whole prompt as prose, don't compress it |
| **Flux (dev/pro)** | Strongest at fine linework and paper grain. Likes long descriptive prompts. The right choice if you're going the ControlNet route |
| **Imagen / Gemini** | Good at the paper and print artefacts. Try it for a texture pass you composite over a cleaner base |
| **SD + ControlNet** | The only route that will honour `map-layout.svg` exactly |

**Aspect ratio**: portrait, 4:5 or 2:3. The funnel points down the sheet.

**Resolution**: models top out around 1–2 megapixels natively, and a large
printed map wants 300dpi. Generate, then upscale 4×, and accept that the first
pass is art direction rather than final output. If you end up redrawing the
zones in vector anyway, only the terrain needs to survive the upscale.

---

## Variations worth trying

- **Era**: swap "1970s" for "1940s WPA-era" (muddier, fewer colours, letterpress
  feel) or "1990s" (cleaner, more colours, laser-sharp)
- **Spookiness**: add *"the lower third of the map printed in slightly colder,
  darker inks than the upper, as though the press ran out of light"* — this is
  how you get the dark-runs-inward gradient without anything explicitly spooky
- **Wear**: *"a soft-pencil route traced on it by a previous hiker, and a coffee
  ring in one corner"* — makes it an object someone owned rather than a prop
- **The joke**: once you're typesetting, the Department's own absurd notices go
  in the margins. That's text work, not image-gen work

---

## What you still do by hand afterwards

1. **All typography.** 22 place names, the theme labels, the legend, the title
   block, the Department's marginalia.
2. **Theme icons** per zone — generate those separately as a small icon set, not
   as part of the map.
3. **The treasure and vantage markers.**
4. **Fold lines**, if you want them registered to actual folds rather than
   printed decoration.
