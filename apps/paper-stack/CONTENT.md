# The content contract

What the display mechanism needs from a CMS, and why. Written from the
mechanism's side so the Sanity adapter stays a thin mapping layer rather
than something the pile has to be rebuilt around.

Everything here is derived from a real constraint in `script.js`. Where a
field is required it is because something breaks without it, and the note
says what.

## A piece

```ts
type Piece = {
  id: string;        // stable across publishes
  slug: string;      // the piece's own route
  title: string;
  image: Image;
  groups: string[];  // group ids, in the CMS's own order
  meta?: Meta[];
  year?: number;
  order?: number;    // explicit sort; falls back to year, then title
};

type Image = {
  src: string;
  width: number;     // intrinsic, required
  height: number;    // intrinsic, required
  alt: string;
  lqip?: string;     // data URI placeholder
  srcset?: string;
};

type Meta = { label: string; value: string };
```

### Why each one is required

**`id`** — the stacking model is a single ordered array of ids, and the
same ids key the saved layout and the z-order inspector. It has to survive
a republish or restored layouts land on the wrong pieces. Sanity's `_id`
is fine. Note the current build's `localStorage` key has no content hash,
so it will restore stale positions the first time the collection changes;
the key needs to include a hash of the id set.

**`slug`** — nothing in the prototype is addressable today. A portfolio
needs a URL per piece for sharing, previews and crawling, and inspect mode
is the natural anchor for it.

**`image.width` / `image.height`** — these are **not** optional. The
mechanism sizes each sheet before paint and positions the whole layout
from those sizes; waiting for `onload` means every view reflows as images
arrive. Sanity carries `asset->metadata.dimensions` natively, so this
costs nothing to provide and is expensive to work around.

**`lqip`** — Sanity generates one per asset. Worth taking: the pile shows
every sheet at once, so a dozen simultaneous image loads is the worst case
for perceived speed, and a blurred placeholder at the right aspect ratio
removes the layout pop entirely.

### `meta` is a list, not fields

The prototype hardcodes `medium · edition · dimensions · gsm` because it
invented its own pieces. Real work does not share one spec sheet — a
screenprint has an edition and a paper weight, a digital piece has
neither, a commission has a client and a year.

So the caption strip renders whatever ordered label/value pairs it is
given, and the CMS decides what is worth printing per piece. In Sanity
this is most naturally an array of objects on the piece document rather
than a fixed set of fields.

## A group

```ts
type Group = {
  id: string;
  slug: string;
  title: string;      // the tab label
  accent?: string;    // the tab's ink edge; falls back to a palette ramp
  order?: number;
};
```

Counts are derived, never authored — the tab shows how many pieces
actually resolve into it.

## Sizing, once images are real

Sheet sizes currently come from paper formats in millimetres. With real
work the aspect ratios are arbitrary, which raises a decision the demo
never had to make.

I would size each sheet to a **constant area**, not a constant long edge.
Sizing by long edge makes a panorama enormous next to a square, and the
pile stops reading as a stack of comparable prints. Constant area keeps
every piece feeling like a sheet of paper of roughly the same stock,
which is the whole conceit. The caption strip then has to scale with the
sheet rather than sit at a fixed 34px.

## What the real schema says

Read from `futurethang/sanity-studio` at `c1527a8` — `schemas/artwork.ts`,
`fields.ts`, `category.ts`. Project `rkukjvpf`, dataset `production`.

Most of the contract is already satisfied, and better than I assumed:

| Contract | `artwork` | |
| --- | --- | --- |
| `id` | `_id` | ✓ |
| `slug` | `slug` | ✓ required |
| `title` | `title` | ✓ required |
| `image.src` | `image` | ✓ required |
| `image.alt` | `image.alt` | ✓ **required**, with the right reasoning in the schema comment |
| `image.width/height` | `asset->metadata.dimensions` | ✓ free from Sanity |
| `image.lqip` | `asset->metadata.lqip` | ✓ free from Sanity |
| `meta` | `medium`, `series`, `year`, `description` | ✓ all optional, as expected |
| `order` | `order` + `pinned` | ✓ better than specified |
| `groups` | — | **✗ nothing to file by** |

Two things the schema adds that the contract missed. `visibility` is a
required public/draft enum, so every query has to filter on it. And
`pinned` is a hand-curation flag — "show this first in any list that
carries it" — which is a sort input, not metadata.

## The taxonomy problem

**`artwork` has no category reference.** `category` is a document type, but
only `post` uses it. The fields an artwork could be filed by are:

| Field | Shape | As a folder axis |
| --- | --- | --- |
| `tags` | references to `tag` docs | Many-to-many. A proper vocabulary with a spelling rule, but a piece lands in several folders at once, which the stacking model cannot take as-is |
| `series` | free-text string, nullable | Sparse by instruction — "leave empty unless the piece belongs with others" — so most work falls into one Unfiled bucket |
| `medium` | free-text string, nullable | Single-valued and semantically right, but free text: no slug, no order, no accent, and "Screenprint" / "screen print" fork silently |
| `year` | number, nullable | Single-valued and always ordered. Drawers by year is literally how a flat file works |

So the filing cabinet cannot be built as designed without a decision. Three
things are true at once:

1. The demo's folders were media — Risograph, Screenprint, Letterpress,
   Offset. `medium` is the axis the design was drawn for, and it already
   exists.
2. As free text it is not good enough to label a tab. Promoting it to a
   reference to a small document type — title, slug, order, accent — gives
   the tabs everything the design needs and kills the spelling drift.
   That is a schema change, not a query change.
3. Tags are the right thing for filtering and the wrong thing for folders,
   because the stacking model assumes folders are disjoint. Opening a
   folder splices its ids to the top of one shared order array, so a piece
   in two folders misbehaves. Supportable, but it is a change to the
   mechanism.

The adapter in `content/sanity.mjs` leaves the axis pluggable — `medium`,
`series`, `year` or `tag` — and reports `overlapping` so the mechanism can
refuse an axis it cannot stack. That keeps the decision open rather than
guessing at it.

## One more unknown

`schemas/index.ts` says `post` is "one type doing five jobs — books,
articles, blog posts, samples and art, told apart by a category reference"
and that `artwork` replaces the parts still wanted, with nothing removed
yet. So some or all of the art may still be `post` documents, and the
`category` documents may be its current grouping. How many `artwork`
documents actually exist, and whether a migration has run, changes what
the first build can show.

## What I still need

The schema says what is possible; only the data says what is there, and
this environment's network policy denies `rkukjvpf.api.sanity.io`, so I
cannot look. The shape of the folder column depends entirely on the
distribution — four media is a design, nineteen is a different one.

Running this in the studio's Vision tab answers it:

```groq
{
  "artworks": count(*[_type == "artwork"]),
  "public": count(*[_type == "artwork" && visibility == "public"]),
  "byMedium": *[_type == "artwork"]{"k": coalesce(medium, "—")} | {
    "counts": array::unique(*[_type == "artwork"].medium)
  },
  "media": array::unique(*[_type == "artwork"].medium),
  "series": array::unique(*[_type == "artwork"].series),
  "years": array::unique(*[_type == "artwork"].year),
  "tags": array::unique(*[_type == "artwork"].tags[]->title),
  "stillInPost": count(*[_type == "post"])
}
```

No API token needed to tell me the result, and none should be pasted into
chat — if the dataset is private the token belongs in a Vercel environment
variable.
