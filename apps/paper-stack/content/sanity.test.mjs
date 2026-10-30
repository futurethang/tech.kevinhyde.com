/* Exercises the adapter against rows shaped exactly as the GROQ projection
 * returns them, including the awkward cases the schema permits: no medium,
 * no series, no year, and a piece carrying several tags. */

import { toCollection, AXES, ARTWORK_QUERY, queryUrl, UNFILED } from './sanity.mjs';
import assert from 'node:assert';

const rows = [
  { _id: 'a1', title: 'Harbor Interference', slug: 'harbor-interference', year: 2024,
    medium: 'Risograph', series: 'Harbor', pinned: true, order: null, tags: ['print', 'two-colour'],
    image: { src: 'https://cdn/x.jpg', width: 2400, height: 3400, lqip: 'data:...', alt: 'A halftone field' } },
  { _id: 'a2', title: 'Nine Registers', slug: 'nine-registers', year: 2023,
    medium: 'Screenprint', series: null, pinned: false, order: 2, tags: ['print'],
    image: { src: 'https://cdn/y.jpg', width: 2000, height: 2000, lqip: null, alt: 'Nine squares' } },
  // the schema makes medium, series and year all optional
  { _id: 'a3', title: 'Untitled', slug: 'untitled', year: null,
    medium: null, series: null, pinned: false, order: null, tags: [],
    image: { src: 'https://cdn/z.jpg', width: 1200, height: 800, lqip: null, alt: '' } },
];

/* medium: single-valued, so folders stay disjoint */
const byMedium = toCollection(rows, { axis: 'medium' });
assert.equal(byMedium.overlapping, false, 'medium must not overlap');
assert.deepEqual(byMedium.groups.map((g) => `${g.title}:${g.count}`),
  ['Risograph:1', 'Screenprint:1', `${UNFILED}:1`]);
assert.equal(byMedium.pieces[2].groups[0], 'unfiled', 'a piece with no medium is still filed');

/* alt falls back to the title rather than shipping an empty string */
assert.equal(byMedium.pieces[2].image.alt, 'Untitled');

/* meta omits what the piece does not have */
assert.deepEqual(byMedium.pieces[0].meta.map((m) => m.label), ['Medium', 'Series', 'Year']);
assert.deepEqual(byMedium.pieces[2].meta, []);

/* dimensions survive, because the layout needs them before paint */
assert.equal(byMedium.pieces[0].image.width, 2400);
assert.equal(byMedium.pieces[0].image.height, 3400);

/* tags: many-to-many, which the stacking model cannot take as-is */
const byTag = toCollection(rows, { axis: 'tag' });
assert.equal(byTag.overlapping, true, 'tag axis must report that folders overlap');
assert.deepEqual(byTag.pieces[0].groups, ['print', 'two-colour']);

/* series is sparse by the schema's own instruction */
const bySeries = toCollection(rows, { axis: 'series' });
const unfiled = bySeries.groups.find((g) => g.title === UNFILED);
assert.equal(unfiled.count, 2, 'two of three pieces have no series');

/* year is always single-valued where present */
const byYear = toCollection(rows, { axis: 'year' });
assert.equal(byYear.overlapping, false);

/* the query filters drafts and sorts the way the schema says to */
assert.match(ARTWORK_QUERY, /visibility == "public"/);
assert.match(ARTWORK_QUERY, /order\(pinned desc, coalesce\(order, 999999\) asc, year desc, title asc\)/);
assert.match(queryUrl(), /^https:\/\/rkukjvpf\.apicdn\.sanity\.io\/v2021-10-21\/data\/query\/production\?query=/);

console.log('all adapter assertions pass');
for (const axis of Object.keys(AXES)) {
  const c = toCollection(rows, { axis });
  console.log(`  ${axis.padEnd(7)} ${String(c.groups.length).padStart(2)} folders` +
    `  overlapping=${c.overlapping}` +
    `  [${c.groups.map((g) => g.title + '×' + g.count).join(', ')}]`);
}
