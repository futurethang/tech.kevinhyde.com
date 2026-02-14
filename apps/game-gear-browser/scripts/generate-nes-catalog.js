#!/usr/bin/env node

/**
 * NES Catalog Generation Script
 *
 * Fetches the file listing from Internet Archive's No-Intro NES collection
 * and generates NES game entries for games.json.
 *
 * Usage:
 *   node scripts/generate-nes-catalog.js
 *
 * This will:
 * 1. Fetch metadata from Internet Archive
 * 2. Filter to quality US/World/Europe titles
 * 3. Deduplicate by base title
 * 4. Merge NES entries into existing games.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_PATH = path.join(__dirname, '../src/data/games.json');
const ARCHIVE_ID = 'ef_nintendo_entertainment_-system_-no-intro_2024-04-23';
const ARCHIVE_BASE = `https://archive.org/download/${ARCHIVE_ID}/`;

// Words/patterns that indicate non-retail or low-quality entries
const EXCLUDE_PATTERNS = [
  /\bpirate\b/i,
  /\bhack\b/i,
  /\bbeta\b/i,
  /\bproto\b/i,
  /\bprototype\b/i,
  /\bdemo\b/i,
  /\bsample\b/i,
  /\bprogram\b/i,
  /competition cart/i,
  /aftermarket/i,
  /homebrew/i,
  /\(test\b/i,
  /\(unl\)/i,
  /\(asia\)/i,
  /\[b\]/i,
  /Virtual Console/i,
  /Switch Online/i,
  /GameCube/i,
  /\bWii\b/i,
  /Namcot Collection/i,
  /Namco Museum/i,
  /Famicom Mini/i,
  /Classic Edition/i,
  /Collection of /i,
  /Arcade Archives/i,
  /FDS Conversion/i,
  /Museum Archives/i,
];

// Regions we want, in priority order
const PREFERRED_REGIONS = ['USA', 'World', 'USA, Europe', 'Europe'];

function parseNoIntro(filename) {
  const nameWithoutExt = filename.replace(/\.zip$/i, '');

  // Extract all parenthetical groups
  const parenMatches = nameWithoutExt.match(/\(([^)]+)\)/g) || [];
  const parenItems = parenMatches.map(p => p.replace(/[()]/g, ''));

  // Extract title (everything before first parenthetical)
  const title = nameWithoutExt.replace(/\s*\(.*$/, '').trim();

  // Parse metadata from parentheticals
  let region = null;
  let revision = null;
  let language = 'en';

  for (const item of parenItems) {
    // Region detection
    if (/^(USA|World|Europe|Japan|USA, Europe|Japan, USA|Japan, Europe)/.test(item)) {
      region = item;
    }
    // Revision
    if (/^Rev\s/i.test(item)) {
      revision = item;
    }
    // Language codes like (En), (En,Fr), etc.
    if (/^(En|Fr|De|Es|It|Pt|Nl|Sv|No|Da|Fi|Zh|Ko|Ja)(,|$)/i.test(item) && !region) {
      language = item.split(',')[0].toLowerCase();
    }
  }

  // Generate slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return {
    title,
    region,
    revision,
    language,
    slug,
  };
}

function shouldInclude(filename) {
  // Must be a .zip file
  if (!filename.endsWith('.zip')) return false;

  // Exclude non-retail entries
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(filename)) return false;
  }

  // Must be from a preferred region
  const hasPreferredRegion = PREFERRED_REGIONS.some(r =>
    filename.includes(`(${r})`) || filename.includes(`(${r},`)
  );
  if (!hasPreferredRegion) return false;

  return true;
}

function regionPriority(region) {
  if (!region) return 99;
  if (region.startsWith('USA')) return 0;
  if (region === 'World') return 1;
  if (region.startsWith('USA, Europe')) return 2;
  if (region.startsWith('Europe')) return 3;
  return 99;
}

async function fetchFileList() {
  console.log(`Fetching metadata from Internet Archive: ${ARCHIVE_ID}...`);
  const url = `https://archive.org/metadata/${ARCHIVE_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Archive.org API error: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

async function main() {
  const files = await fetchFileList();
  console.log(`Total files in collection: ${files.length}`);

  // Filter to eligible .zip game files
  const eligible = files
    .map(f => f.name)
    .filter(shouldInclude);

  console.log(`Eligible files after filtering: ${eligible.length}`);

  // Parse and deduplicate by base title (prefer USA > World > Europe, non-Rev over Rev)
  const byTitle = new Map();

  for (const filename of eligible) {
    const parsed = parseNoIntro(filename);
    const key = parsed.title.toLowerCase();
    const existing = byTitle.get(key);

    if (!existing) {
      byTitle.set(key, { filename, parsed });
    } else {
      // Prefer better region
      const existingPriority = regionPriority(existing.parsed.region);
      const newPriority = regionPriority(parsed.region);

      if (newPriority < existingPriority) {
        byTitle.set(key, { filename, parsed });
      } else if (newPriority === existingPriority) {
        // Same region: prefer non-revision over revision
        if (existing.parsed.revision && !parsed.revision) {
          byTitle.set(key, { filename, parsed });
        }
      }
    }
  }

  console.log(`Unique titles after dedup: ${byTitle.size}`);

  // Generate game entries
  const games = [];
  for (const [, { filename, parsed }] of byTitle) {
    const id = parsed.slug + '-' + Math.random().toString(36).substr(2, 5);
    const romUrl = ARCHIVE_BASE + encodeURIComponent(filename);

    games.push({
      id,
      system: 'nes',
      title: parsed.title,
      year: null,
      publisher: null,
      region: parsed.region || 'US',
      language: parsed.language,
      flags: [],
      filename,
      romUrl,
      boxartUrl: null,
      isBadDump: false,
      isAlternate: false,
    });
  }

  // Sort alphabetically
  games.sort((a, b) => a.title.localeCompare(b.title));

  // Merge into existing games.json
  const existingGames = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf-8'));
  // Remove any existing NES entries (in case of re-run)
  const nonNes = existingGames.filter(g => g.system !== 'nes');
  const merged = [...nonNes, ...games];

  fs.writeFileSync(GAMES_PATH, JSON.stringify(merged, null, 2) + '\n');

  console.log(`\nResults:`);
  console.log(`  NES games added: ${games.length}`);
  console.log(`  Existing non-NES games: ${nonNes.length}`);
  console.log(`  Total games in catalog: ${merged.length}`);
  console.log(`\nSaved to: ${GAMES_PATH}`);
}

main().catch(console.error);
