#!/usr/bin/env node

/**
 * Fix boxart URLs by matching game titles against actual libretro-thumbnails filenames.
 *
 * Fetches the real file listing from the libretro-thumbnails GitHub repo and
 * uses fuzzy matching to find the best boxart for each game.
 *
 * Usage:
 *   node scripts/fix-boxart-urls.js                # Process all systems
 *   node scripts/fix-boxart-urls.js --system nes    # Process only NES games
 *   node scripts/fix-boxart-urls.js --system gamegear
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_PATH = path.join(__dirname, '../src/data/games.json');

// System thumbnail repos (must match systems.js)
const SYSTEM_THUMBNAIL_REPOS = {
  gamegear: 'Sega_-_Game_Gear',
  nes: 'Nintendo_-_Nintendo_Entertainment_System',
};

function normalizeForMatch(name) {
  return name
    .replace(/\.(zip|png)$/i, '')
    .replace(/&/g, '_')
    .replace(/['']/g, "'")
    .toLowerCase()
    .trim();
}

function extractBaseTitle(name) {
  // Remove extension, then remove everything from first ( onward
  return name
    .replace(/\.(zip|png)$/i, '')
    .replace(/&/g, '_')
    .replace(/\s*\(.*$/, '')
    .replace(/\s*\[.*$/, '')
    .toLowerCase()
    .trim();
}

function tokenize(str) {
  // Extract meaningful words for substring matching
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function scoreMatch(gameTitle, boxartFile) {
  const gameTokens = tokenize(gameTitle);
  const boxartBase = boxartFile.replace(/\.(png)$/i, '').toLowerCase();
  const boxartTokens = tokenize(boxartBase);

  let matchedTokens = 0;
  for (const token of gameTokens) {
    if (boxartTokens.some(bt => bt === token || bt.includes(token) || token.includes(bt))) {
      matchedTokens++;
    }
  }

  if (gameTokens.length === 0) return 0;
  const score = matchedTokens / gameTokens.length;
  // Bonus: penalize betas and bad dumps
  const penalty = (boxartBase.includes('beta') || boxartBase.includes('[b')) ? 0.1 : 0;
  return score - penalty;
}

async function fetchBoxartList(thumbnailRepo) {
  console.log(`Fetching boxart file list from libretro-thumbnails/${thumbnailRepo}...`);
  const url = `https://api.github.com/repos/libretro-thumbnails/${thumbnailRepo}/git/trees/master?recursive=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();

  return data.tree
    .filter(t => t.path.startsWith('Named_Boxarts/') && t.path.endsWith('.png'))
    .map(t => t.path.replace('Named_Boxarts/', ''));
}

function findBestMatch(game, boxartFiles, boxartByBase) {
  const filename = game.filename;

  // Strategy 1: Exact filename match (swap .zip -> .png, & -> _)
  const exactName = filename.replace(/\.zip$/i, '.png').replace(/&/g, '_');
  if (boxartFiles.has(exactName)) {
    return { file: exactName, strategy: 'exact' };
  }

  // Strategy 2: Match by base title - find best candidate
  const gameBase = extractBaseTitle(filename);
  const candidates = boxartByBase.get(gameBase);
  if (candidates && candidates.length > 0) {
    // Prefer non-beta, non-bad-dump versions
    const preferred = candidates.find(c =>
      !c.toLowerCase().includes('beta') &&
      !c.toLowerCase().includes('[b') &&
      !c.toLowerCase().includes('(alt)')
    ) || candidates[0];
    return { file: preferred, strategy: 'base-title' };
  }

  // Strategy 3: Try with common title variations
  const gameTitle = game.title.replace(/&/g, '_').toLowerCase();
  for (const [base, files] of boxartByBase) {
    if (base === gameTitle) {
      const preferred = files.find(f =>
        !f.toLowerCase().includes('beta') && !f.toLowerCase().includes('[b')
      ) || files[0];
      return { file: preferred, strategy: 'title-match' };
    }
  }

  // Strategy 4: Fuzzy token matching across all boxart files
  let bestScore = 0;
  let bestFile = null;
  for (const file of boxartFiles) {
    const score = scoreMatch(game.title, file);
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      bestFile = file;
    }
  }
  if (bestFile) {
    return { file: bestFile, strategy: `fuzzy (${(bestScore * 100).toFixed(0)}%)` };
  }

  // Strategy 5: Check if game title appears as substring in any boxart filename
  const titleLower = game.title.toLowerCase().replace(/&/g, '_');
  for (const file of boxartFiles) {
    const fileLower = file.toLowerCase();
    if (fileLower.includes(titleLower) || titleLower.includes(extractBaseTitle(file))) {
      if (!fileLower.includes('beta') && !fileLower.includes('[b')) {
        return { file, strategy: 'substring' };
      }
    }
  }

  return null;
}

async function processSystem(systemId, games) {
  const thumbnailRepo = SYSTEM_THUMBNAIL_REPOS[systemId];
  if (!thumbnailRepo) {
    console.log(`No thumbnail repo configured for system: ${systemId}, skipping.`);
    return { exact: 0, fuzzy: 0, noMatch: 0, unmatched: [] };
  }

  const thumbnailBase = `https://raw.githubusercontent.com/libretro-thumbnails/${thumbnailRepo}/master/Named_Boxarts/`;
  const boxartList = await fetchBoxartList(thumbnailRepo);

  console.log(`  Found ${boxartList.length} boxart files for ${systemId}`);

  // Build lookup structures
  const boxartFiles = new Set(boxartList);
  const boxartByBase = new Map();
  for (const file of boxartList) {
    const base = extractBaseTitle(file);
    if (!boxartByBase.has(base)) boxartByBase.set(base, []);
    boxartByBase.get(base).push(file);
  }

  let exact = 0, fuzzy = 0, noMatch = 0;
  const unmatched = [];

  for (const game of games) {
    const match = findBestMatch(game, boxartFiles, boxartByBase);
    if (match) {
      game.boxartUrl = thumbnailBase + encodeURIComponent(match.file).replace(/%20/g, '%20');
      if (match.strategy === 'exact') exact++;
      else fuzzy++;
    } else {
      game.boxartUrl = null;
      noMatch++;
      unmatched.push(game.title);
    }
  }

  return { exact, fuzzy, noMatch, unmatched };
}

async function main() {
  // Parse --system argument
  const args = process.argv.slice(2);
  const systemIdx = args.indexOf('--system');
  const targetSystem = systemIdx !== -1 ? args[systemIdx + 1] : null;

  const allGames = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf-8'));

  // Determine which systems to process
  const systemsInData = [...new Set(allGames.map(g => g.system))];
  const systemsToProcess = targetSystem ? [targetSystem] : systemsInData;

  console.log(`Processing systems: ${systemsToProcess.join(', ')}`);
  console.log(`Total games in catalog: ${allGames.length}\n`);

  for (const systemId of systemsToProcess) {
    const systemGames = allGames.filter(g => g.system === systemId);
    if (systemGames.length === 0) {
      console.log(`No games found for system: ${systemId}`);
      continue;
    }

    console.log(`\nProcessing ${systemId} (${systemGames.length} games)...`);
    const result = await processSystem(systemId, systemGames);

    console.log(`  Results:`);
    console.log(`    Exact match: ${result.exact}`);
    console.log(`    Fuzzy match: ${result.fuzzy}`);
    console.log(`    No match:    ${result.noMatch}`);
    if (result.unmatched.length > 0 && result.unmatched.length <= 20) {
      console.log(`    Unmatched:`);
      result.unmatched.forEach(t => console.log(`      - ${t}`));
    } else if (result.unmatched.length > 20) {
      console.log(`    Unmatched: ${result.unmatched.length} games (too many to list)`);
    }
  }

  fs.writeFileSync(GAMES_PATH, JSON.stringify(allGames, null, 2) + '\n');
  console.log(`\nUpdated ${GAMES_PATH}`);
}

main().catch(console.error);
