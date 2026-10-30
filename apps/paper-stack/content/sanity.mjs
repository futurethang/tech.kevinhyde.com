/* Sanity → the display mechanism's content contract.
 *
 * Studio: futurethang/sanity-studio, project rkukjvpf, dataset production.
 * The source of truth for field names is schemas/artwork.ts over there.
 *
 * `artwork` carries no category reference — see CONTENT.md — so the folder
 * axis is derived from a field rather than read from a group document. The
 * axis is pluggable precisely because that decision is not settled.
 */

export const PROJECT = 'rkukjvpf';
export const DATASET = 'production';

/* Ordering follows the schema's own stated intent: `pinned` is "show this
 * first in any list that carries it", and `order` is "lower sorts first,
 * leave empty to fall back to newest". Hence pinned, then explicit order
 * with blanks last, then newest, then title as the final tiebreak so the
 * sequence is stable between builds. */
export const ARTWORK_QUERY = `
*[_type == "artwork" && visibility == "public"]{
  _id,
  title,
  "slug": slug.current,
  year,
  medium,
  series,
  description,
  pinned,
  order,
  "tags": tags[]->title,
  "image": {
    "src": image.asset->url,
    "width": image.asset->metadata.dimensions.width,
    "height": image.asset->metadata.dimensions.height,
    "aspect": image.asset->metadata.dimensions.aspectRatio,
    "lqip": image.asset->metadata.lqip,
    "alt": image.alt
  }
} | order(pinned desc, coalesce(order, 999999) asc, year desc, title asc)
`.trim();

export function queryUrl(query = ARTWORK_QUERY, { useCdn = true } = {}) {
  const host = useCdn ? `${PROJECT}.apicdn.sanity.io` : `${PROJECT}.api.sanity.io`;
  return `https://${host}/v2021-10-21/data/query/${DATASET}?query=${encodeURIComponent(query)}`;
}

const slugify = (s) =>
  String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ── folder axes ──
 * Each returns the group titles a piece belongs to. Returning more than one
 * is allowed by the contract but not by the current stacking model, which
 * assumes folders are disjoint. `byTag` is the one that breaks it. */

export const AXES = {
  medium: (p) => (p.medium ? [p.medium] : []),
  series: (p) => (p.series ? [p.series] : []),
  year: (p) => (p.year ? [String(p.year)] : []),
  tag: (p) => p.tags || [],
};

/** Pieces with nothing on the chosen axis still have to go somewhere. */
export const UNFILED = 'Unfiled';

/**
 * Map a raw GROQ result to the contract in CONTENT.md.
 *
 * `meta` is assembled here rather than in the renderer because which facts
 * are worth printing is a content question, not a layout one — and because
 * an artwork may legitimately have none of them.
 */
export function toPieces(rows, { axis = 'medium' } = {}) {
  const pick = AXES[axis] || AXES.medium;

  return rows.map((r) => {
    const groups = pick(r);
    const meta = [];
    if (r.medium) meta.push({ label: 'Medium', value: r.medium });
    if (r.series) meta.push({ label: 'Series', value: r.series });
    if (r.year) meta.push({ label: 'Year', value: String(r.year) });

    return {
      id: r._id,
      slug: r.slug,
      title: r.title,
      image: {
        src: r.image?.src,
        width: r.image?.width,
        height: r.image?.height,
        // the schema requires alt, but a draft asset can still arrive bare
        alt: r.image?.alt || r.title,
        lqip: r.image?.lqip,
      },
      groups: (groups.length ? groups : [UNFILED]).map(slugify),
      groupTitles: groups.length ? groups : [UNFILED],
      meta,
      description: r.description || null,
      year: r.year ?? null,
      pinned: !!r.pinned,
    };
  });
}

/**
 * Derive the folder set from the pieces themselves.
 *
 * There is no group document to read titles, order or accents from, so the
 * column's order is the order folders are first encountered — which, because
 * the query is already sorted, means pinned and hand-ordered work decides
 * which folder leads. That is a side effect, not a design; a real group
 * document would make it explicit.
 */
export function toGroups(pieces) {
  const seen = new Map();
  for (const p of pieces) {
    p.groupTitles.forEach((title, i) => {
      const id = p.groups[i];
      if (!seen.has(id)) seen.set(id, { id, slug: id, title, count: 0 });
      seen.get(id).count++;
    });
  }
  return [...seen.values()];
}

/** Everything the mechanism needs, in one call. */
export function toCollection(rows, opts = {}) {
  const pieces = toPieces(rows, opts);
  const groups = toGroups(pieces);
  const overlapping = pieces.some((p) => p.groups.length > 1);
  return { pieces, groups, overlapping, axis: opts.axis || 'medium' };
}
