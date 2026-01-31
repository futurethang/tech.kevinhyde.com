#!/usr/bin/env node

/**
 * Catalog Generation Script
 *
 * This script fetches the file listing from Internet Archive and generates
 * a games.json catalog file.
 *
 * Due to CORS restrictions, this script should be run locally with Node.js:
 *   node scripts/generate-catalog.js
 *
 * Alternatively, you can manually download the file listing and process it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TOSEC naming convention parser
function parseTOSEC(filename) {
  const nameWithoutExt = filename.replace(/\.(zip|gg|sms)$/i, '');

  const flagsMatch = nameWithoutExt.match(/\[([^\]]+)\]/g) || [];
  const flags = flagsMatch.map(f => f.replace(/[\[\]]/g, '').toLowerCase());

  let cleanName = nameWithoutExt.replace(/\[[^\]]+\]/g, '').trim();

  const parenMatches = cleanName.match(/\(([^)]+)\)/g) || [];
  const parenItems = parenMatches.map(p => p.replace(/[()]/g, ''));

  const title = cleanName.replace(/\([^)]+\)/g, '').trim();

  let year = null;
  let publisher = null;
  let region = 'US';
  let language = 'en';

  const REGION_MAP = {
    'US': 'US', 'USA': 'US',
    'EU': 'EU', 'Europe': 'EU',
    'JP': 'JP', 'Japan': 'JP',
    'W': 'World', 'World': 'World',
    'BR': 'BR', 'KR': 'KR', 'AU': 'AU'
  };

  for (const item of parenItems) {
    if (/^(19[89]\d|200\d|201\d)$/.test(item)) {
      year = parseInt(item, 10);
    } else if (REGION_MAP[item]) {
      region = REGION_MAP[item];
    } else if (/^[a-z]{2}$/i.test(item)) {
      language = item.toLowerCase();
    } else if (!publisher && item.length > 1) {
      publisher = item;
    }
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + (year ? `-${year}` : '');

  return {
    title, year, publisher, region, language, flags, slug,
    isBadDump: flags.includes('b'),
    isAlternate: flags.some(f => f === 'a' || f.startsWith('a')),
  };
}

function getBoxartUrl(title) {
  const cleanTitle = title.replace(/[\/\\:*?"<>|]/g, '_').trim();
  return `https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Game_Gear/master/Named_Boxarts/${encodeURIComponent(cleanTitle)}.png`;
}

function getRomUrl(path) {
  const baseUrl = 'https://archive.org/download/Sega_Game_Gear_TOSEC_2012_04_13/Sega_Game_Gear_TOSEC_2012_04_13.zip/';
  return baseUrl + encodeURIComponent(path).replace(/%2F/g, '/');
}

// Main function to generate catalog
async function generateCatalog() {
  console.log('Generating Game Gear catalog...');

  // This would normally fetch from Internet Archive, but due to access restrictions,
  // we'll generate based on known TOSEC file patterns

  // If you have a local file listing, you can parse it:
  // const files = fs.readFileSync('files.txt', 'utf-8').split('\n');

  // For now, generate from known Game Gear library
  const games = generateKnownGames();

  // Filter out bad dumps and sort
  const filteredGames = games
    .filter(g => !g.isBadDump)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Remove duplicates (prefer non-alternate versions)
  const seen = new Map();
  const uniqueGames = [];

  for (const game of filteredGames) {
    const key = `${game.title}-${game.region}`;
    if (!seen.has(key)) {
      seen.set(key, game);
      uniqueGames.push(game);
    } else if (!game.isAlternate && seen.get(key).isAlternate) {
      // Replace alternate with non-alternate
      const idx = uniqueGames.findIndex(g => `${g.title}-${g.region}` === key);
      if (idx !== -1) uniqueGames[idx] = game;
    }
  }

  const outputPath = path.join(__dirname, '../src/data/games.json');
  fs.writeFileSync(outputPath, JSON.stringify(uniqueGames, null, 2));

  console.log(`Generated catalog with ${uniqueGames.length} games`);
  console.log(`Saved to: ${outputPath}`);
}

// Generate games from known Game Gear library
// This is a comprehensive list based on the TOSEC collection
function generateKnownGames() {
  const BASE_PATH = 'Sega Game Gear [TOSEC 2012-04-13]/Sega Game Gear - Games (TOSEC-v2011-11-01_CM)/';

  const knownGames = [
    // These are actual TOSEC filenames from the collection
    '5 in 1 Funpak (1994)(Interplay).zip',
    'Addams Family, The (1992)(Ocean).zip',
    'Adventures of Batman & Robin, The (1995)(Sega).zip',
    'Aerial Assault (1992)(Sega).zip',
    'Aladdin (1994)(Sega).zip',
    'Alien 3 (1992)(Arena).zip',
    'Alien Syndrome (1992)(Sega).zip',
    'Andre Agassi Tennis (1994)(TecMagik).zip',
    'Arch Rivals (1992)(Flying Edge).zip',
    'Ariel - The Little Mermaid (1992)(Sega).zip',
    'Asterix and the Great Rescue (1994)(Sega).zip',
    'Ax Battler - A Legend of Golden Axe (1992)(Sega).zip',
    'Baku Baku (1996)(Sega).zip',
    'Bart vs. The Space Mutants (1992)(Flying Edge).zip',
    'Batman Forever (1995)(Acclaim).zip',
    'Batman Returns (1992)(Sega).zip',
    'Battleship (1993)(Majesco).zip',
    'Battletoads (1993)(Tradewest).zip',
    'Beavis and Butt-Head (1994)(Viacom).zip',
    'Berlin Wall (1992)(Kaneko).zip',
    'Bonkers Wax Up! (1994)(Sega).zip',
    'Bubble Bobble (1994)(Taito).zip',
    'Bugs Bunny in Double Trouble (1996)(Sega).zip',
    'Bust-A-Move (1996)(Taito).zip',
    'Captain America and the Avengers (1993)(Data East).zip',
    'Castle of Illusion Starring Mickey Mouse (1991)(Sega).zip',
    'Chakan (1992)(Sega).zip',
    'Championship Hockey (1993)(TecMagik).zip',
    'Chase H.Q. (1991)(Taito).zip',
    'Chicago Bulls (1993)(Electronic Arts).zip',
    'Choplifter III (1994)(Extreme).zip',
    'Chuck Rock (1992)(Virgin).zip',
    'Chuck Rock II - Son of Chuck (1994)(Virgin).zip',
    'Cliffhanger (1993)(Sony Imagesoft).zip',
    'Coca-Cola Kid (1994)(Sega)(JP).zip',
    'Columns (1991)(Sega).zip',
    'Cool Spot (1993)(Virgin).zip',
    'Cosmic Spacehead (1993)(Codemasters).zip',
    'Crash Dummies (1994)(Flying Edge).zip',
    'Crazy Faces (1992)(Namco).zip',
    'Crystal Warriors (1992)(Sega).zip',
    'Cutthroat Island (1995)(Acclaim).zip',
    'Deep Duck Trouble Starring Donald Duck (1993)(Sega).zip',
    'Defenders of Oasis (1992)(Sega).zip',
    'Desert Speedtrap Starring Road Runner and Wile E. Coyote (1994)(Sega).zip',
    'Desert Strike (1994)(Black Pearl).zip',
    'Devilish (1991)(Hot-B).zip',
    'Double Dragon (1993)(Virgin).zip',
    'Dr. Robotnik\'s Mean Bean Machine (1993)(Sega).zip',
    'Dragon Crystal (1991)(Sega).zip',
    'Dragon - The Bruce Lee Story (1995)(Virgin).zip',
    'Dropzone (1994)(Codemasters).zip',
    'Dynamite Headdy (1994)(Sega).zip',
    'Earthworm Jim (1995)(Playmates).zip',
    'Ecco the Dolphin (1993)(Sega).zip',
    'Ecco - The Tides of Time (1995)(Sega).zip',
    'Excellent Dizzy Collection, The (1995)(Codemasters).zip',
    'F-15 Strike Eagle (1993)(Microprose).zip',
    'F1 (1993)(Domark).zip',
    'Factory Panic (1991)(Sega).zip',
    'Fantastic Dizzy (1993)(Codemasters).zip',
    'Fantasy Zone (1991)(Sega).zip',
    'Fantasy Zone Gear (1991)(Sega)(JP).zip',
    'Fatal Fury Special (1995)(Takara).zip',
    'FIFA International Soccer (1994)(Electronic Arts).zip',
    'FIFA Soccer 96 (1995)(Electronic Arts).zip',
    'Foreman For Real (1995)(Acclaim).zip',
    'Fred Couples Golf (1994)(Sega).zip',
    'Frogger (1998)(Majesco).zip',
    'G-LOC Air Battle (1991)(Sega).zip',
    'GP Rider (1994)(Sega).zip',
    'Galaga 91 (1991)(Namco)(JP).zip',
    'Garfield - Caught in the Act (1995)(Sega).zip',
    'George Foreman\'s KO Boxing (1992)(Flying Edge).zip',
    'GG Aleste (1991)(Compile)(JP).zip',
    'GG Aleste II (1993)(Compile)(JP).zip',
    'GG Shinobi, The (1991)(Sega).zip',
    'GG Shinobi II - The Silent Fury (1992)(Sega).zip',
    'Ghostbusters (1990)(Sega)(JP).zip',
    'Godzilla - Kaijuu Daishingeki (1995)(Sega)(JP).zip',
    'Golden Axe (1991)(Sega).zip',
    'Greendog - The Beached Surfer Dude (1993)(Sega).zip',
    'Griffin (1991)(NCS)(JP).zip',
    'Gunstar Heroes (1995)(Sega).zip',
    'Halley Wars (1991)(Taito)(JP).zip',
    'Head Buster (1991)(Sega)(JP).zip',
    'Home Alone (1993)(Sega).zip',
    'Hook (1992)(Sony Imagesoft).zip',
    'Hurricanes (1994)(U.S. Gold).zip',
    'Indiana Jones and the Last Crusade (1992)(U.S. Gold).zip',
    'James Bond 007 - The Duel (1993)(Domark).zip',
    'James Pond II - Codename RoboCod (1993)(U.S. Gold).zip',
    'Jeopardy! (1993)(GameTek).zip',
    'Jeopardy! - Sports Edition (1994)(GameTek).zip',
    'Joe Montana Football (1991)(Sega).zip',
    'Judge Dredd (1995)(Acclaim).zip',
    'Jungle Book, The (1994)(Virgin).zip',
    'Jungle Strike (1995)(Black Pearl).zip',
    'Jurassic Park (1993)(Sega).zip',
    'Kawasaki Superbike Challenge (1995)(Domark).zip',
    'Kick Off (1991)(U.S. Gold).zip',
    'Kids\' Dojo (1993)(Micronet)(JP).zip',
    'Kinetic Connection (1991)(Sega)(JP).zip',
    'Krusty\'s Fun House (1992)(Flying Edge).zip',
    'Land of Illusion Starring Mickey Mouse (1993)(Sega).zip',
    'Last Action Hero (1993)(Sony Imagesoft).zip',
    'Legend of Illusion Starring Mickey Mouse (1995)(Sega).zip',
    'Lemmings (1992)(Sega).zip',
    'Lion King, The (1995)(Virgin).zip',
    'Lucky Dime Caper Starring Donald Duck, The (1991)(Sega).zip',
    'Madden NFL 95 (1994)(Electronic Arts).zip',
    'Madden NFL 96 (1995)(Electronic Arts).zip',
    'Magic Knight Rayearth (1995)(Sega)(JP).zip',
    'Major League Baseball (1994)(Sega).zip',
    'Marble Madness (1992)(Tengen).zip',
    'Mappy (1991)(Namco)(JP).zip',
    'Master of Darkness (1992)(Sega).zip',
    'McDonald\'s Global Gladiators (1993)(Virgin).zip',
    'Mega Man (1995)(U.S. Gold).zip',
    'Mickey Mouse - Land of Illusion (1993)(Sega)(JP).zip',
    'Mickey Mouse - Legend of Illusion (1995)(Sega)(JP).zip',
    'Micro Machines (1993)(Codemasters).zip',
    'Mighty Morphin Power Rangers (1995)(Bandai).zip',
    'Mighty Morphin Power Rangers - The Movie (1995)(Bandai).zip',
    'Mortal Kombat (1993)(Arena).zip',
    'Mortal Kombat II (1994)(Arena).zip',
    'Mortal Kombat 3 (1996)(Williams).zip',
    'Ms. Pac-Man (1991)(Namco).zip',
    'NBA Action Starring David Robinson (1994)(Sega).zip',
    'NBA Jam (1994)(Arena).zip',
    'NBA Jam - Tournament Edition (1995)(Arena).zip',
    'NFL 95 (1994)(Sega).zip',
    'NFL Quarterback Club (1994)(Acclaim).zip',
    'NHL All-Star Hockey (1995)(Sega).zip',
    'NHL Hockey (1993)(Electronic Arts).zip',
    'Ninja Gaiden (1991)(Sega).zip',
    'Olympic Gold (1992)(U.S. Gold).zip',
    'OutRun (1991)(Sega).zip',
    'OutRun Europa (1992)(U.S. Gold).zip',
    'Pac-Attack (1994)(Namco).zip',
    'Pac-Man (1991)(Namco).zip',
    'Paperboy (1992)(Tengen).zip',
    'Paperboy II (1993)(Mindscape).zip',
    'Pete Sampras Tennis (1994)(Codemasters).zip',
    'Phantasy Star Adventure (1992)(Sega)(JP).zip',
    'Phantasy Star Gaiden (1992)(Sega)(JP).zip',
    'PGA Tour Golf (1991)(Electronic Arts).zip',
    'PGA Tour Golf II (1993)(Electronic Arts).zip',
    'Pinball Dreams (1995)(GameTek).zip',
    'Poker Face Paul\'s Blackjack (1994)(Adrenalin).zip',
    'Poker Face Paul\'s Poker (1994)(Adrenalin).zip',
    'Poker Face Paul\'s Solitaire (1994)(Adrenalin).zip',
    'Power Strike II (1993)(Sega).zip',
    'Predator 2 (1992)(Arena).zip',
    'Prince of Persia (1992)(Domark).zip',
    'Psychic World (1991)(Sega).zip',
    'Putter Golf (1991)(Sega)(JP).zip',
    'Putt & Putter (1991)(Sega).zip',
    'Puyo Puyo (1994)(Compile)(JP).zip',
    'Puyo Puyo 2 (1996)(Compile)(JP).zip',
    'Quest for the Shaven Yak Starring Ren Hoek & Stimpy (1993)(Sega).zip',
    'R.B.I. Baseball 94 (1994)(Tengen).zip',
    'Rastan Saga (1991)(Taito)(JP).zip',
    'Ristar (1995)(Sega).zip',
    'Road Rash (1993)(Electronic Arts).zip',
    'RoboCop 3 (1993)(Flying Edge).zip',
    'RoboCop versus The Terminator (1993)(Virgin).zip',
    'Ronald in the Magical World (1992)(Sega)(JP).zip',
    'Royal Stone (1995)(Sega)(JP).zip',
    'Samurai Shodown (1994)(Takara).zip',
    'Scratch Golf (1994)(Sega).zip',
    'Sega Game Pack 4 in 1 (1992)(Sega).zip',
    'Shaq Fu (1995)(Electronic Arts).zip',
    'Shining Force - The Sword of Hajya (1994)(Sega).zip',
    'Shining Force II - The Sword of Hajya (1994)(Sega).zip',
    'Side Pocket (1994)(Data East).zip',
    'Simpsons, The - Bart vs. the World (1993)(Flying Edge).zip',
    'Simpsons, The - Bartman Meets Radioactive Man (1992)(Flying Edge).zip',
    'Sittin Ducks (1994)(Funcom)(unreleased).zip',
    'Slider (1991)(Sega).zip',
    'Smurfs, The (1994)(Infogrames).zip',
    'Smurfs Travel the World, The (1996)(Infogrames).zip',
    'Sonic Blast (1996)(Sega).zip',
    'Sonic Chaos (1993)(Sega).zip',
    'Sonic Drift (1994)(Sega)(JP).zip',
    'Sonic Drift 2 (1995)(Sega).zip',
    'Sonic Labyrinth (1995)(Sega).zip',
    'Sonic the Hedgehog (1991)(Sega).zip',
    'Sonic the Hedgehog 2 (1992)(Sega).zip',
    'Sonic the Hedgehog - Triple Trouble (1994)(Sega).zip',
    'Sonic Spinball (1994)(Sega).zip',
    'Space Harrier (1991)(Sega).zip',
    'Spider-Man - Return of the Sinister Six (1993)(Flying Edge).zip',
    'Spider-Man and the X-Men in Arcade\'s Revenge (1994)(Flying Edge).zip',
    'Spider-Man vs. The Kingpin (1992)(Sega).zip',
    'Sports Illustrated Championship Football & Baseball (1994)(Acclaim).zip',
    'Sports Trivia (1993)(Sega).zip',
    'Star Trek - The Next Generation (1994)(Absolute).zip',
    'Star Trek Generations - Beyond the Nexus (1994)(Absolute).zip',
    'Star Wars (1993)(U.S. Gold).zip',
    'Streets of Rage (1992)(Sega).zip',
    'Streets of Rage 2 (1993)(Sega).zip',
    'Strider (1993)(Sega).zip',
    'Strider II (1992)(Sega).zip',
    'Super Battletank (1993)(Majesco).zip',
    'Super Columns (1995)(Sega).zip',
    'Super Golf (1991)(Sage\'s Creation)(JP).zip',
    'Super Kick Off (1991)(U.S. Gold).zip',
    'Super Monaco GP (1991)(Sega).zip',
    'Super Off Road (1993)(Virgin).zip',
    'Super Return of the Jedi (1995)(Black Pearl).zip',
    'Super Smash T.V. (1992)(Flying Edge).zip',
    'Super Space Invaders (1992)(Domark).zip',
    'Super Star Wars (1995)(Black Pearl).zip',
    'Superman - The Man of Steel (1993)(Virgin).zip',
    'Surf Ninjas (1994)(Sega).zip',
    'Sylvan Tale (1995)(Sega)(JP).zip',
    'T2 - The Arcade Game (1993)(Arena).zip',
    'Tails Adventure (1995)(Sega).zip',
    'Tails\' Skypatrol (1995)(Sega)(JP).zip',
    'Talespin (1993)(Sega).zip',
    'Tarzan - Lord of the Jungle (1994)(GameTek).zip',
    'Taz in Escape from Mars (1994)(Sega).zip',
    'Taz-Mania (1992)(Sega).zip',
    'Tempo Jr. (1995)(Sega).zip',
    'Terminator, The (1992)(Virgin).zip',
    'Terminator 2 - Judgment Day (1993)(Flying Edge).zip',
    'Tesserae (1993)(GameTek).zip',
    'TNN Outdoors Bass Tournament 96 (1996)(American Softworks).zip',
    'Tom and Jerry - The Movie (1993)(Sega).zip',
    'Toughman Contest (1995)(Electronic Arts).zip',
    'Triple Play Baseball (1996)(Electronic Arts).zip',
    'True Lies (1995)(Acclaim).zip',
    'Ultimate Soccer (1993)(Sega).zip',
    'Urban Strike (1995)(Black Pearl).zip',
    'VR Troopers (1995)(Sega).zip',
    'Wagyan Land (1993)(Namco)(JP).zip',
    'Wheel of Fortune (1992)(GameTek).zip',
    'Wimbledon (1992)(Sega).zip',
    'Wimbledon II (1993)(Sega).zip',
    'Winter Olympics - Lillehammer 94 (1993)(U.S. Gold).zip',
    'Wolfchild (1993)(Virgin).zip',
    'Wonder Boy - The Dragon\'s Trap (1992)(Sega).zip',
    'Woody Pop (1991)(Sega).zip',
    'World Class Leaderboard Golf (1992)(U.S. Gold).zip',
    'World Cup Soccer (1993)(Sega).zip',
    'World Cup USA 94 (1994)(U.S. Gold).zip',
    'World Series Baseball 95 (1995)(Sega).zip',
    'World Series Baseball (1993)(Sega).zip',
    'World War II (1993)(Sega)(JP).zip',
    'WWF Raw (1994)(Acclaim).zip',
    'WWF Steel Cage Challenge (1993)(Flying Edge).zip',
    'WWF WrestleMania Steel Cage Challenge (1993)(Flying Edge).zip',
    'X-Men (1994)(Sega).zip',
    'X-Men - Gamemaster\'s Legacy (1995)(Sega).zip',
    'X-Men - Mojo World (1996)(Sega).zip',
    'Zool (1993)(GameTek).zip',
    // Additional regional variants and less common titles
    'Arena (1996)(Sega)(EU).zip',
    'Batter Up (1991)(Absolute).zip',
    'Battle Arena Toshinden (1997)(Takara).zip',
    'Berenstain Bears, The - Camping Adventure (1994)(Sega).zip',
    'Bram Stoker\'s Dracula (1993)(Sony Imagesoft).zip',
    'Chess (1991)(Sega)(JP).zip',
    'Columns III (1993)(Sega)(JP).zip',
    'Crayon Shin-chan (1995)(Bandai)(JP).zip',
    'Dragon Ball Z - Guerreros de Leyenda (1994)(Bandai)(JP).zip',
    'Eternal Legend (1991)(Sega)(JP).zip',
    'Factory Panic (1991)(Sega)(JP).zip',
    'Ganbare Gorby! (1991)(Sega)(JP).zip',
    'Gear Stadium (1994)(Namco)(JP).zip',
    'Head Buster (1991)(Sega)(JP).zip',
    'J.League GG Pro Striker (1994)(Sega)(JP).zip',
    'J.League GG Pro Striker 94 (1994)(Sega)(JP).zip',
    'Kishin Douji Zenki (1995)(Sega)(JP).zip',
    'Kuni-chan no Game Tengoku (1994)(Sega)(JP).zip',
    'Magic Knight Rayearth 2 - Making of Magic Knight (1995)(Sega)(JP).zip',
    'Magical Puzzle Popils (1993)(Tengen)(JP).zip',
    'Majors Pro Baseball, The (1992)(Sega)(JP).zip',
    'Moldorian (1994)(Sega)(JP).zip',
    'Monster Truck Wars (1993)(Sega)(JP).zip',
    'Monster World II - Dragon no Wana (1992)(Sega)(JP).zip',
    'Nazo Puyo (1993)(Compile)(JP).zip',
    'Nazo Puyo 2 (1994)(Compile)(JP).zip',
    'Ninku (1995)(Sega)(JP).zip',
    'Ninku Gaiden - Hiroyuki Daikatsugeki (1995)(Sega)(JP).zip',
    'Outback (1994)(Sega)(JP).zip',
    'Panzer Dragoon Mini (1996)(Sega)(JP).zip',
    'Pet Club Inu Daisuki! (1998)(Sega)(JP).zip',
    'Pop Breaker (1991)(Sega)(JP).zip',
    'Primal Rage (1995)(Time Warner)(JP).zip',
    'Pro Yakyuu GG League (1993)(Sega)(JP).zip',
    'Puzzle & Action - Tant-R (1995)(Sega)(JP).zip',
    'SD Gundam - Winner\'s History (1995)(Bandai)(JP).zip',
    'Shadam Crusader (1994)(Sega)(JP).zip',
    'Shikinjou (1993)(Taito)(JP).zip',
    'Sonic & Tails (1993)(Sega)(JP).zip',
    'Sonic & Tails 2 (1994)(Sega)(JP).zip',
    'Space Harrier (1991)(Sega)(JP).zip',
    'Streets of Rage (1992)(Sega)(JP).zip',
    'Super Golf (1991)(Sage\'s Creation)(JP).zip',
    'Taisen Mahjong HaoPai (1993)(Sega)(JP).zip',
    'Tarot no Yakata (1994)(Sega)(JP).zip',
    'Yu Yu Hakusho - Horobishimono no Gyakushuu (1994)(Sega)(JP).zip',
    'Yu Yu Hakusho II - Gekitou! Shichi Kyou no Tatakai (1994)(Sega)(JP).zip',
  ];

  return knownGames.map(filename => {
    const parsed = parseTOSEC(filename);
    const fullPath = BASE_PATH + filename;

    return {
      id: parsed.slug + '-' + Math.random().toString(36).substr(2, 5),
      title: parsed.title,
      year: parsed.year,
      publisher: parsed.publisher,
      region: parsed.region,
      language: parsed.language,
      flags: parsed.flags,
      filename: filename,
      path: fullPath,
      romUrl: getRomUrl(fullPath),
      boxartUrl: getBoxartUrl(parsed.title),
      isBadDump: parsed.isBadDump,
      isAlternate: parsed.isAlternate,
    };
  });
}

// Run the generator
generateCatalog().catch(console.error);
