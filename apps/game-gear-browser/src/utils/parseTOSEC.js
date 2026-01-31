/**
 * Parse TOSEC naming convention to extract metadata
 * Format: Title (Year)(Publisher)(Region)(Language)[flags].ext
 *
 * Examples:
 * - Sonic the Hedgehog 2 (1992)(Sega).zip
 * - Aladdin (1994)(Sega)(JP)(en).zip
 * - Game Name (1993)(Publisher)[b].zip  (bad dump)
 * - Game Name (1993)(Publisher)[a].zip  (alternate)
 */

const REGION_MAP = {
  'US': 'US',
  'USA': 'US',
  'EU': 'EU',
  'Europe': 'EU',
  'JP': 'JP',
  'Japan': 'JP',
  'W': 'World',
  'World': 'World',
  'BR': 'BR',
  'Brazil': 'BR',
  'KR': 'KR',
  'Korea': 'KR',
  'AU': 'AU',
  'Australia': 'AU',
};

const FLAG_DESCRIPTIONS = {
  'b': 'Bad Dump',
  'a': 'Alternate',
  'p': 'Pirate',
  'o': 'Overdump',
  'u': 'Underdump',
  'h': 'Hack',
  'f': 'Fixed',
  't': 'Trained',
  'cr': 'Cracked',
  'tr': 'Translation',
};

/**
 * Parse a TOSEC filename and extract metadata
 * @param {string} filename - The filename to parse
 * @returns {object} Parsed metadata
 */
export function parseTOSEC(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(zip|gg|sms)$/i, '');

  // Extract flags in square brackets [b], [a], [tr en], etc.
  const flagsMatch = nameWithoutExt.match(/\[([^\]]+)\]/g) || [];
  const flags = flagsMatch.map(f => f.replace(/[\[\]]/g, '').toLowerCase());

  // Remove flags from the name
  let cleanName = nameWithoutExt.replace(/\[[^\]]+\]/g, '').trim();

  // Extract parenthetical items: (Year)(Publisher)(Region)(Language)
  const parenMatches = cleanName.match(/\(([^)]+)\)/g) || [];
  const parenItems = parenMatches.map(p => p.replace(/[()]/g, ''));

  // Remove parentheticals to get the title
  const title = cleanName.replace(/\([^)]+\)/g, '').trim();

  // Parse parenthetical items
  let year = null;
  let publisher = null;
  let region = 'US'; // Default to US
  let language = 'en'; // Default to English

  for (const item of parenItems) {
    // Year: 4-digit number between 1980-2020
    if (/^(19[89]\d|200\d|201\d|202\d)$/.test(item)) {
      year = parseInt(item, 10);
    }
    // Region codes
    else if (REGION_MAP[item]) {
      region = REGION_MAP[item];
    }
    // Language codes (2 letters)
    else if (/^[a-z]{2}$/i.test(item)) {
      language = item.toLowerCase();
    }
    // Publisher (anything else that's not already matched)
    else if (!publisher && item.length > 1) {
      publisher = item;
    }
  }

  // Generate a slug for the ID
  const slug = generateSlug(title, year, publisher);

  return {
    title,
    year,
    publisher,
    region,
    language,
    flags,
    isBadDump: flags.includes('b'),
    isAlternate: flags.includes('a'),
    isPirate: flags.includes('p'),
    isHack: flags.includes('h'),
    isTranslation: flags.some(f => f.startsWith('tr')),
    slug,
  };
}

/**
 * Generate a URL-safe slug from game metadata
 */
function generateSlug(title, year, publisher) {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  if (year) {
    slug += `-${year}`;
  }

  if (publisher) {
    const pubSlug = publisher
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    slug += `-${pubSlug}`;
  }

  return slug;
}

/**
 * Generate a boxart URL from game title
 */
export function getBoxartUrl(title) {
  // Clean title for libretro-thumbnails format
  const cleanTitle = title
    .replace(/[\/\\:*?"<>|]/g, '_') // Replace invalid filename chars
    .trim();

  return `https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Game_Gear/master/Named_Boxarts/${encodeURIComponent(cleanTitle)}.png`;
}

/**
 * Generate the ROM URL for Internet Archive
 */
export function getRomUrl(path) {
  const baseUrl = 'https://archive.org/download/Sega_Game_Gear_TOSEC_2012_04_13/Sega_Game_Gear_TOSEC_2012_04_13.zip/';
  return baseUrl + encodeURIComponent(path).replace(/%2F/g, '/');
}

export default parseTOSEC;
