#!/usr/bin/env node

/**
 * SNES Catalog Generation Script
 *
 * Fetches the file listing from Internet Archive's SNES ROM collection
 * and generates SNES game entries for games.json.
 *
 * Usage:
 *   node scripts/generate-snes-catalog.js
 *
 * This will:
 * 1. Fetch metadata from Internet Archive
 * 2. Filter to quality US/World/Europe titles (verified dumps only)
 * 3. Deduplicate by base title
 * 4. Generate boxart URLs from libretro-thumbnails
 * 5. Merge SNES entries into existing games.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_PATH = path.join(__dirname, '../src/data/games.json');
const ARCHIVE_ID = 'snesromsetcompleate';
const ARCHIVE_BASE = `https://archive.org/download/${ARCHIVE_ID}/`;
const THUMBNAIL_REPO = 'Nintendo_-_Super_Nintendo_Entertainment_System';
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
  /\[o\]/i,
  /\[f\]/i,
  /Virtual Console/i,
  /Switch Online/i,
  /SNES Classic/i,
  /Classic Edition/i,
  /Collection of /i,
  /BS-X/i,
  /Satellaview/i,
  /SuFami Turbo/i,
  /NP /i,
];

// Regions we want, in priority order
const PREFERRED_REGIONS = ['U', 'USA', 'World'];

// Map raw regions to normalized short codes
const REGION_NORMALIZE = {
  'U': 'US',
  'USA': 'US',
  'World': 'World',
  'USA, Europe': 'US',
  'E': 'EU',
  'Europe': 'EU',
  'J': 'JP',
  'Japan': 'JP',
};

/**
 * Parse SNES ROM filenames from this archive.
 * Naming convention: {Game Title} (U) [!].zip
 * where (U) = USA, [!] = verified dump
 */
function parseSnesFilename(filename) {
  const nameWithoutExt = filename.replace(/\.zip$/i, '');

  // Extract all parenthetical and bracket groups
  const parenMatches = nameWithoutExt.match(/\(([^)]+)\)/g) || [];
  const parenItems = parenMatches.map(p => p.replace(/[()]/g, ''));
  const bracketMatches = nameWithoutExt.match(/\[([^\]]+)\]/g) || [];
  const bracketItems = bracketMatches.map(b => b.replace(/[\[\]]/g, ''));

  // Extract title (everything before first parenthetical or bracket)
  const title = nameWithoutExt.replace(/\s*[\(\[].*$/, '').trim();

  // Parse region from parentheticals
  let region = null;
  for (const item of parenItems) {
    if (/^(U|USA|World|E|Europe|J|Japan|USA, Europe|JU|UE)$/i.test(item)) {
      region = item;
      break;
    }
  }

  // Check for verified dump [!]
  const isVerified = bracketItems.includes('!');

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
    isVerified,
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

  // Must be from a preferred region (USA/World)
  const hasPreferredRegion = PREFERRED_REGIONS.some(r =>
    filename.includes(`(${r})`)
  );
  if (!hasPreferredRegion) return false;

  return true;
}

function regionPriority(region) {
  if (!region) return 99;
  if (region === 'U' || region === 'USA') return 0;
  if (region === 'World') return 1;
  if (region === 'USA, Europe' || region === 'UE') return 2;
  if (region === 'E' || region === 'Europe') return 3;
  if (region === 'J' || region === 'Japan') return 4;
  return 99;
}

function generateBoxartUrl(title, region) {
  // libretro-thumbnails uses No-Intro style naming
  const regionStr = REGION_NORMALIZE[region] || 'US';
  // Map short codes back to full names for thumbnail lookup
  const thumbRegion = regionStr === 'US' ? 'USA' : regionStr === 'EU' ? 'Europe' : regionStr === 'JP' ? 'Japan' : regionStr;
  const thumbName = `${title} (${thumbRegion})`;
  return THUMBNAIL_BASE + encodeURIComponent(thumbName) + '.png';
}

// Curated list of verified USA SNES titles from the snesromsetcompleate archive.
// Used as fallback when the Archive.org API is unreachable.
const CURATED_FILENAMES = [
  'Actraiser (U) [!].zip',
  'Actraiser 2 (U) [!].zip',
  'Aero the Acro-Bat (U) [!].zip',
  'Aero the Acro-Bat 2 (U) [!].zip',
  'Aladdin (U) [!].zip',
  'Alien 3 (U) [!].zip',
  'Animaniacs (U) [!].zip',
  'Axelay (U) [!].zip',
  'B.O.B. (U) [!].zip',
  'Ballz 3D (U) [!].zip',
  'Batman Returns (U) [!].zip',
  'Battle Clash (U) [!].zip',
  'Battletoads & Double Dragon (U) [!].zip',
  'Battletoads in Battlemaniacs (U) [!].zip',
  'Bazooka Blitzkrieg (U) [!].zip',
  'Biker Mice from Mars (U) [!].zip',
  'Blackthorne (U) [!].zip',
  'Bomberman 1 (U) [!].zip',
  'Bomberman 2 (U) [!].zip',
  'Breath of Fire (U) [!].zip',
  'Breath of Fire II (U) [!].zip',
  'Bust-A-Move (U) [!].zip',
  'Castlevania - Dracula X (U) [!].zip',
  'Chrono Trigger (U) [!].zip',
  'Clay Fighter (U) [!].zip',
  'Clay Fighter 2 - Judgement Clay (U) [!].zip',
  'Contra III - The Alien Wars (U) [!].zip',
  'Cool Spot (U) [!].zip',
  'Cybernator (U) [!].zip',
  'Darius Twin (U) [!].zip',
  'Demon\'s Crest (U) [!].zip',
  'Desert Strike (U) [!].zip',
  'Disney\'s Goof Troop (U) [!].zip',
  'Donkey Kong Country (U) [!].zip',
  'Donkey Kong Country 2 - Diddy\'s Kong Quest (U) [!].zip',
  'Donkey Kong Country 3 - Dixie Kong\'s Double Trouble! (U) [!].zip',
  'Doom (U) [!].zip',
  'Dragon Ball Z - Super Butouden 2 (U) [!].zip',
  'EarthBound (U) [!].zip',
  'Earthworm Jim (U) [!].zip',
  'Earthworm Jim 2 (U) [!].zip',
  'EVO - Search for Eden (U) [!].zip',
  'F-Zero (U) [!].zip',
  'Fatal Fury 2 (U) [!].zip',
  'Fatal Fury Special (U) [!].zip',
  'FIFA International Soccer (U) [!].zip',
  'Final Fantasy II (U) [!].zip',
  'Final Fantasy III (U) [!].zip',
  'Final Fantasy - Mystic Quest (U) [!].zip',
  'Final Fight (U) [!].zip',
  'Final Fight 2 (U) [!].zip',
  'Final Fight 3 (U) [!].zip',
  'Firepower 2000 (U) [!].zip',
  'Flashback (U) [!].zip',
  'Gradius III (U) [!].zip',
  'Gundam Wing - Endless Duel (U) [!].zip',
  'Harvest Moon (U) [!].zip',
  'Illusion of Gaia (U) [!].zip',
  'Indiana Jones\' Greatest Adventures (U) [!].zip',
  'International Superstar Soccer Deluxe (U) [!].zip',
  'Joe & Mac (U) [!].zip',
  'Jurassic Park (U) [!].zip',
  'Killer Instinct (U) [!].zip',
  'King of Dragons, The (U) [!].zip',
  'Kirby Super Star (U) [!].zip',
  'Kirby\'s Avalanche (U) [!].zip',
  'Kirby\'s Dream Course (U) [!].zip',
  'Kirby\'s Dream Land 3 (U) [!].zip',
  'Knights of the Round (U) [!].zip',
  'Legend of the Mystical Ninja, The (U) [!].zip',
  'Legend of Zelda, The - A Link to the Past (U) [!].zip',
  'Lemmings (U) [!].zip',
  'Lion King, The (U) [!].zip',
  'Lost Vikings, The (U) [!].zip',
  'Lufia & the Fortress of Doom (U) [!].zip',
  'Lufia II - Rise of the Sinistrals (U) [!].zip',
  'Madden NFL \'94 (U) [!].zip',
  'Magical Quest Starring Mickey Mouse, The (U) [!].zip',
  'Mega Man 7 (U) [!].zip',
  'Mega Man X (U) [!].zip',
  'Mega Man X2 (U) [!].zip',
  'Mega Man X3 (U) [!].zip',
  'Metal Combat - Falcon\'s Revenge (U) [!].zip',
  'Metal Warriors (U) [!].zip',
  'Mortal Kombat (U) [!].zip',
  'Mortal Kombat II (U) [!].zip',
  'Mortal Kombat 3 (U) [!].zip',
  'NBA Jam (U) [!].zip',
  'NBA Jam - Tournament Edition (U) [!].zip',
  'NHL \'94 (U) [!].zip',
  'Ninja Gaiden Trilogy (U) [!].zip',
  'Ogre Battle - The March of the Black Queen (U) [!].zip',
  'Out of This World (U) [!].zip',
  'Pac-Man 2 - The New Adventures (U) [!].zip',
  'Pilotwings (U) [!].zip',
  'Plok (U) [!].zip',
  'Pocky & Rocky (U) [!].zip',
  'Pocky & Rocky 2 (U) [!].zip',
  'Pop\'n TwinBee (U) [!].zip',
  'Power Rangers - The Fighting Edition (U) [!].zip',
  'Prince of Persia (U) [!].zip',
  'R-Type III (U) [!].zip',
  'Rival Turf! (U) [!].zip',
  'Road Runner\'s Death Valley Rally (U) [!].zip',
  'Rock n\' Roll Racing (U) [!].zip',
  'Run Saber (U) [!].zip',
  'Secret of Evermore (U) [!].zip',
  'Secret of Mana (U) [!].zip',
  'Shadowrun (U) [!].zip',
  'SimCity (U) [!].zip',
  'SimCity 2000 (U) [!].zip',
  'Skyblazer (U) [!].zip',
  'Soul Blazer (U) [!].zip',
  'Space Megaforce (U) [!].zip',
  'Spider-Man & Venom - Maximum Carnage (U) [!].zip',
  'Star Fox (U) [!].zip',
  'Star Ocean (U) [!].zip',
  'Street Fighter Alpha 2 (U) [!].zip',
  'Street Fighter II (U) [!].zip',
  'Street Fighter II Turbo (U) [!].zip',
  'Stunt Race FX (U) [!].zip',
  'Sunset Riders (U) [!].zip',
  'Super Adventure Island (U) [!].zip',
  'Super Bomberman (U) [!].zip',
  'Super Bomberman 2 (U) [!].zip',
  'Super Castlevania IV (U) [!].zip',
  'Super Double Dragon (U) [!].zip',
  'Super Ghouls \'n Ghosts (U) [!].zip',
  'Super Mario All-Stars (U) [!].zip',
  'Super Mario Kart (U) [!].zip',
  'Super Mario RPG (U) [!].zip',
  'Super Mario World (U) [!].zip',
  'Super Mario World 2 - Yoshi\'s Island (U) [!].zip',
  'Super Metroid (U) [!].zip',
  'Super Punch-Out!! (U) [!].zip',
  'Super R-Type (U) [!].zip',
  'Super Star Wars (U) [!].zip',
  'Super Star Wars - Return of the Jedi (U) [!].zip',
  'Super Star Wars - The Empire Strikes Back (U) [!].zip',
  'Super Street Fighter II (U) [!].zip',
  'Super Tennis (U) [!].zip',
  'Super Turrican (U) [!].zip',
  'Super Turrican 2 (U) [!].zip',
  'SWAT Kats (U) [!].zip',
  'Tales of Phantasia (U) [!].zip',
  'Tecmo Super Bowl (U) [!].zip',
  'Teenage Mutant Ninja Turtles IV - Turtles in Time (U) [!].zip',
  'Terranigma (U) [!].zip',
  'Tetris & Dr. Mario (U) [!].zip',
  'Tetris Attack (U) [!].zip',
  'Top Gear (U) [!].zip',
  'Top Gear 2 (U) [!].zip',
  'Top Gear 3000 (U) [!].zip',
  'Toy Story (U) [!].zip',
  'Trials of Mana (U) [!].zip',
  'True Lies (U) [!].zip',
  'Tuff E Nuff (U) [!].zip',
  'UN Squadron (U) [!].zip',
  'Uniracers (U) [!].zip',
  'Vegas Stakes (U) [!].zip',
  'Wario\'s Woods (U) [!].zip',
  'Wild Guns (U) [!].zip',
  'Wing Commander (U) [!].zip',
  'Wolfenstein 3D (U) [!].zip',
  'Wolverine - Adamantium Rage (U) [!].zip',
  'X-Men - Mutant Apocalypse (U) [!].zip',
  'Yoshi\'s Cookie (U) [!].zip',
  'Zombies Ate My Neighbors (U) [!].zip',
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

  // Filter to eligible .zip game files
  const eligible = files
    .map(f => f.name)
    .filter(shouldInclude);

  console.log(`Eligible files after filtering: ${eligible.length}`);

  // Parse and deduplicate by base title
  const byTitle = new Map();

  for (const filename of eligible) {
    const parsed = parseSnesFilename(filename);
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
        // Same region: prefer verified over non-verified
        if (!existing.parsed.isVerified && parsed.isVerified) {
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
      system: 'snes',
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
  // Remove any existing SNES entries (in case of re-run)
  const nonSnes = existingGames.filter(g => g.system !== 'snes');
  const merged = [...nonSnes, ...games];

  fs.writeFileSync(GAMES_PATH, JSON.stringify(merged, null, 2) + '\n');

  console.log(`\nResults:`);
  console.log(`  SNES games added: ${games.length}`);
  console.log(`  Existing non-SNES games: ${nonSnes.length}`);
  console.log(`  Total games in catalog: ${merged.length}`);
  console.log(`\nSaved to: ${GAMES_PATH}`);
}

main().catch(console.error);
