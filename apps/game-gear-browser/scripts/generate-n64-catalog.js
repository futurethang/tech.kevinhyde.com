#!/usr/bin/env node

/**
 * Nintendo 64 Catalog Generation Script
 *
 * Fetches the file listing from Internet Archive's curated N64 ROM collection
 * and generates N64 game entries for games.json.
 *
 * Usage:
 *   node scripts/generate-n64-catalog.js
 *
 * This will:
 * 1. Fetch metadata from Internet Archive
 * 2. Filter to quality US/World/Europe titles
 * 3. Deduplicate by base title
 * 4. Generate boxart URLs from libretro-thumbnails
 * 5. Merge N64 entries into existing games.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_PATH = path.join(__dirname, '../src/data/games.json');
const ARCHIVE_ID = 'roms-bestset-nintendo-64';
const ARCHIVE_BASE = `https://archive.org/download/${ARCHIVE_ID}/`;
const THUMBNAIL_REPO = 'Nintendo_-_Nintendo_64';
const THUMBNAIL_BASE = `https://raw.githubusercontent.com/libretro-thumbnails/${THUMBNAIL_REPO}/master/Named_Boxarts/`;

// Words/patterns that indicate non-retail or low-quality entries
const EXCLUDE_PATTERNS = [
  /^\[BIOS\]/i,
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
  /\[b\]/i,
  /\[h\]/i,
  /\[t\]/i,
  /\[f\]/i,
  /Virtual Console/i,
  /Switch Online/i,
  /Collection of /i,
  /Expansion Pak/i,
  /GameShark/i,
  /Action Replay/i,
];

// Regions we want, in priority order
const PREFERRED_REGIONS = ['USA', 'World', 'USA, Europe', 'Europe'];

// Map raw regions to normalized short codes
const REGION_NORMALIZE = {
  'USA': 'US',
  'World': 'World',
  'USA, Europe': 'US',
  'Europe': 'EU',
  'Japan': 'JP',
  'Japan, USA': 'US',
};

/**
 * Parse N64 ROM filenames from this archive.
 * Naming convention: {Game Title} ({Region}).n64.zip
 */
function parseN64Filename(filename) {
  // Remove the .n64.zip or .z64.zip extension
  const nameWithoutExt = filename
    .replace(/\.n64\.zip$/i, '')
    .replace(/\.z64\.zip$/i, '')
    .replace(/\.zip$/i, '');

  // Extract all parenthetical groups
  const parenMatches = nameWithoutExt.match(/\(([^)]+)\)/g) || [];
  const parenItems = parenMatches.map(p => p.replace(/[()]/g, ''));

  // Extract title (everything before first parenthetical)
  const title = nameWithoutExt.replace(/\s*\(.*$/, '').trim();

  // Parse region from parentheticals
  let region = null;
  let revision = null;

  for (const item of parenItems) {
    // Region detection
    if (/^(USA|World|Europe|Japan|USA, Europe|Japan, USA|Japan, Europe)$/i.test(item)) {
      region = item;
    }
    // Revision
    if (/^Rev\s/i.test(item) || /^V\d/i.test(item)) {
      revision = item;
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
    slug,
  };
}

function shouldInclude(filename) {
  // Must be a .zip file (containing .n64 or .z64)
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

function generateBoxartUrl(title, region) {
  const regionStr = region || 'USA';
  const thumbName = `${title} (${regionStr})`;
  return THUMBNAIL_BASE + encodeURIComponent(thumbName) + '.png';
}

// Curated list of USA N64 titles from the roms-bestset-nintendo-64 archive.
// Used as fallback when the Archive.org API is unreachable.
const CURATED_FILENAMES = [
  '1080 Snowboarding (USA).n64.zip',
  'AeroFighters Assault (USA).n64.zip',
  'Aidyn Chronicles - The First Mage (USA).n64.zip',
  'Banjo-Kazooie (USA).n64.zip',
  'Banjo-Tooie (USA).n64.zip',
  'Beetle Adventure Racing! (USA).n64.zip',
  'Blast Corps (USA).n64.zip',
  'Body Harvest (USA).n64.zip',
  'Bomberman 64 (USA).n64.zip',
  'Bomberman 64 - The Second Attack! (USA).n64.zip',
  'Bomberman Hero (USA).n64.zip',
  'Buck Bumble (USA).n64.zip',
  'Bust-A-Move 2 - Arcade Edition (USA).n64.zip',
  'Castlevania (USA).n64.zip',
  'Castlevania - Legacy of Darkness (USA).n64.zip',
  'Chameleon Twist (USA).n64.zip',
  'Command & Conquer (USA).n64.zip',
  'Conker\'s Bad Fur Day (USA).n64.zip',
  'Cruis\'n Exotica (USA).n64.zip',
  'Cruis\'n USA (USA).n64.zip',
  'Cruis\'n World (USA).n64.zip',
  'Diddy Kong Racing (USA).n64.zip',
  'Doom 64 (USA).n64.zip',
  'Duke Nukem 64 (USA).n64.zip',
  'Duke Nukem - Zero Hour (USA).n64.zip',
  'Excitebike 64 (USA).n64.zip',
  'Extreme-G (USA).n64.zip',
  'Extreme-G 2 (USA).n64.zip',
  'F-Zero X (USA).n64.zip',
  'Gauntlet Legends (USA).n64.zip',
  'Glover (USA).n64.zip',
  'GoldenEye 007 (USA).n64.zip',
  'Harvest Moon 64 (USA).n64.zip',
  'Hexen (USA).n64.zip',
  'Indiana Jones and the Infernal Machine (USA).n64.zip',
  'International Superstar Soccer 64 (USA).n64.zip',
  'Jet Force Gemini (USA).n64.zip',
  'Killer Instinct Gold (USA).n64.zip',
  'Kirby 64 - The Crystal Shards (USA).n64.zip',
  'Legend of Zelda, The - Majora\'s Mask (USA).n64.zip',
  'Legend of Zelda, The - Ocarina of Time (USA).n64.zip',
  'Lego Racers (USA).n64.zip',
  'Mario Golf (USA).n64.zip',
  'Mario Kart 64 (USA).n64.zip',
  'Mario Party (USA).n64.zip',
  'Mario Party 2 (USA).n64.zip',
  'Mario Party 3 (USA).n64.zip',
  'Mario Tennis (USA).n64.zip',
  'Mega Man 64 (USA).n64.zip',
  'Mischief Makers (USA).n64.zip',
  'Mortal Kombat 4 (USA).n64.zip',
  'Mortal Kombat Trilogy (USA).n64.zip',
  'Mystical Ninja Starring Goemon (USA).n64.zip',
  'NBA Hangtime (USA).n64.zip',
  'NFL Blitz (USA).n64.zip',
  'Ogre Battle 64 - Person of Lordly Caliber (USA).n64.zip',
  'Paper Mario (USA).n64.zip',
  'Perfect Dark (USA).n64.zip',
  'Pilotwings 64 (USA).n64.zip',
  'Pokemon Puzzle League (USA).n64.zip',
  'Pokemon Snap (USA).n64.zip',
  'Pokemon Stadium (USA).n64.zip',
  'Pokemon Stadium 2 (USA).n64.zip',
  'Quake (USA).n64.zip',
  'Quake II (USA).n64.zip',
  'Quest 64 (USA).n64.zip',
  'Rayman 2 - The Great Escape (USA).n64.zip',
  'Ready 2 Rumble Boxing (USA).n64.zip',
  'Resident Evil 2 (USA).n64.zip',
  'Ridge Racer 64 (USA).n64.zip',
  'Road Rash 64 (USA).n64.zip',
  'Rocket - Robot on Wheels (USA).n64.zip',
  'Rush 2 - Extreme Racing USA (USA).n64.zip',
  'San Francisco Rush - Extreme Racing (USA).n64.zip',
  'Shadow Man (USA).n64.zip',
  'Sin and Punishment (USA).n64.zip',
  'Snowboard Kids (USA).n64.zip',
  'Snowboard Kids 2 (USA).n64.zip',
  'Space Station Silicon Valley (USA).n64.zip',
  'Spider-Man (USA).n64.zip',
  'Star Fox 64 (USA).n64.zip',
  'Star Wars - Rogue Squadron (USA).n64.zip',
  'Star Wars Episode I - Racer (USA).n64.zip',
  'Star Wars - Shadows of the Empire (USA).n64.zip',
  'Super Mario 64 (USA).n64.zip',
  'Super Smash Bros. (USA).n64.zip',
  'Superman (USA).n64.zip',
  'Tetrisphere (USA).n64.zip',
  'Tony Hawk\'s Pro Skater (USA).n64.zip',
  'Tony Hawk\'s Pro Skater 2 (USA).n64.zip',
  'Tony Hawk\'s Pro Skater 3 (USA).n64.zip',
  'Top Gear Overdrive (USA).n64.zip',
  'Top Gear Rally (USA).n64.zip',
  'Turok - Dinosaur Hunter (USA).n64.zip',
  'Turok 2 - Seeds of Evil (USA).n64.zip',
  'Turok 3 - Shadow of Oblivion (USA).n64.zip',
  'Wave Race 64 (USA).n64.zip',
  'Wayne Gretzky\'s 3D Hockey (USA).n64.zip',
  'WCW-nWo Revenge (USA).n64.zip',
  'Wetrix (USA).n64.zip',
  'WinBack - Covert Operations (USA).n64.zip',
  'Wipeout 64 (USA).n64.zip',
  'Wrestlemania 2000 (USA).n64.zip',
  'WWF No Mercy (USA).n64.zip',
  'Yoshi\'s Story (USA).n64.zip',
];

async function fetchFileList() {
  console.log(`Fetching metadata from Internet Archive: ${ARCHIVE_ID}...`);
  try {
    const url = `https://archive.org/metadata/${ARCHIVE_ID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive.org API error: ${res.status}`);
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.log(`Could not reach Archive.org (${err.message}), using curated fallback list...`);
    return CURATED_FILENAMES.map(name => ({ name }));
  }
}

async function main() {
  const files = await fetchFileList();
  console.log(`Total files in collection: ${files.length}`);

  // Filter to eligible game files
  const eligible = files
    .map(f => f.name)
    .filter(shouldInclude);

  console.log(`Eligible files after filtering: ${eligible.length}`);

  // Parse and deduplicate by base title (prefer USA > World > Europe, non-Rev over Rev)
  const byTitle = new Map();

  for (const filename of eligible) {
    const parsed = parseN64Filename(filename);
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
    const normalizedRegion = REGION_NORMALIZE[parsed.region] || 'US';

    games.push({
      id,
      system: 'n64',
      title: parsed.title,
      year: null,
      publisher: null,
      region: normalizedRegion,
      language: 'en',
      flags: [],
      filename,
      romUrl,
      boxartUrl: generateBoxartUrl(parsed.title, parsed.region),
      isBadDump: false,
      isAlternate: false,
    });
  }

  // Sort alphabetically
  games.sort((a, b) => a.title.localeCompare(b.title));

  // Merge into existing games.json
  const existingGames = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf-8'));
  // Remove any existing N64 entries (in case of re-run)
  const nonN64 = existingGames.filter(g => g.system !== 'n64');
  const merged = [...nonN64, ...games];

  fs.writeFileSync(GAMES_PATH, JSON.stringify(merged, null, 2) + '\n');

  console.log(`\nResults:`);
  console.log(`  N64 games added: ${games.length}`);
  console.log(`  Existing non-N64 games: ${nonN64.length}`);
  console.log(`  Total games in catalog: ${merged.length}`);
  console.log(`\nSaved to: ${GAMES_PATH}`);
}

main().catch(console.error);
