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

## What the taxonomy has to answer

These decide whether the filing cabinet survives as designed. The demo was
rigged — I rebalanced it to exactly four groups of three to make the left
column look right, and real taxonomies rarely oblige.

1. **How many groups?** The column holds roughly four to eight tabs before
   it needs scrolling or nesting, at which point it is a different design.
2. **Can a piece be in more than one?** The current code assumes disjoint
   sets: opening a folder splices its ids to the top of the order array,
   which misbehaves if a piece belongs to two folders. Many-to-many is
   supportable but it is a change, not a config flag.
3. **Are groups nested?** A two-level taxonomy needs either a disclosure
   on the tab or a different metaphor.
4. **Is the grouping lopsided?** One folder of 40 and three of 2 is a
   legitimate shape for a portfolio and an awkward one for this UI. Worth
   knowing before the design pass rather than after.
5. **Is category even the right browse axis?** Year, series or medium may
   be the way someone actually wants to move through the work. The
   mechanism does not care — it groups by whatever it is handed.

## To write the adapter I need

- The schema definitions — the studio's `schemaTypes` / `schemas`
  directory, or just the piece and category documents.
- The project id and dataset name.
- Whether the dataset is public or private.

**Do not paste an API token into the chat.** If the dataset is private the
token belongs in a Vercel environment variable, and I can write the
adapter against the schema without ever holding it.
