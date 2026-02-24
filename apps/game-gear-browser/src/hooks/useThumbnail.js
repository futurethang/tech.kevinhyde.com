import { useState, useEffect, useRef } from 'react';
import { SYSTEMS } from '../data/systems';

/**
 * Global thumbnail URL cache shared across all component instances.
 *
 * Maps a cache key (system + title + region) to a resolved image URL,
 * or `false` if every candidate URL has been exhausted.
 *
 * Using a module-level Map means:
 *  - A URL that already 404'd is never fetched again, even by a
 *    different card that references the same game.
 *  - A URL that already resolved skips the probe entirely.
 */
const resolvedCache = new Map();   // key → url | false
const inflightProbes = new Map();  // key → Promise<string | false>

/**
 * libretro-thumbnails replaces certain characters in filenames.
 * The most impactful one is  &  →  _
 */
function sanitizeForLibretro(title) {
  return title.replace(/&/g, '_');
}

/**
 * Build the ordered list of candidate thumbnail URLs for a game.
 *
 * The order reflects likelihood of a hit – boxart with the exact
 * No-Intro region tag first, then sanitised variants, then screenshots.
 */
function buildCandidates(game) {
  const sys = SYSTEMS[game.system];
  if (!sys?.thumbnailRepo) return [];

  const base = `https://raw.githubusercontent.com/libretro-thumbnails/${sys.thumbnailRepo}/master`;
  const title = game.title;
  const sanitized = sanitizeForLibretro(title);
  const hasSanitizedDiff = sanitized !== title;

  // Derive the full region string used in No-Intro filenames.
  // Our games.json normalises regions (USA → US, Europe → EU), so we
  // map back to what libretro-thumbnails actually uses.
  const regionMap = { US: 'USA', EU: 'Europe', World: 'World', BR: 'Brazil' };
  const region = regionMap[game.region] || game.region || 'USA';

  const candidates = [];

  // If the game already has a boxartUrl from the catalog generator, try it first.
  if (game.boxartUrl) {
    candidates.push(game.boxartUrl);
  }

  // Boxart with sanitised title (& → _)
  if (hasSanitizedDiff) {
    candidates.push(`${base}/Named_Boxarts/${enc(sanitized)} (${region}).png`);
  }

  // Screenshot (Named_Snaps) — these tend to be more consistently available
  candidates.push(`${base}/Named_Snaps/${enc(title)} (${region}).png`);

  if (hasSanitizedDiff) {
    candidates.push(`${base}/Named_Snaps/${enc(sanitized)} (${region}).png`);
  }

  // Title screen
  candidates.push(`${base}/Named_Titles/${enc(title)} (${region}).png`);

  if (hasSanitizedDiff) {
    candidates.push(`${base}/Named_Titles/${enc(sanitized)} (${region}).png`);
  }

  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

function enc(str) {
  return encodeURIComponent(str);
}

/**
 * Probe a single URL via a headless Image load.
 * Resolves to `true` on success, `false` on error.
 */
function probeUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Walk the candidate list sequentially until one loads, then cache it.
 * If all fail, cache `false` so we never retry.
 */
async function resolveThumb(key, candidates) {
  for (const url of candidates) {
    const ok = await probeUrl(url);
    if (ok) {
      resolvedCache.set(key, url);
      return url;
    }
  }
  resolvedCache.set(key, false);
  return false;
}

/**
 * useThumbnail — resolve the best available thumbnail for a game.
 *
 * Returns { src, loaded }
 *  - `src`    : the resolved image URL, or `null` if still probing / all failed
 *  - `loaded` : false while probing, true once resolved (hit or miss)
 *
 * The hook never triggers redundant network requests:
 *  - Results are cached in a module-level Map shared across every card.
 *  - Concurrent mounts for the same game share a single in-flight probe.
 */
export function useThumbnail(game) {
  const key = `${game.system}::${game.title}::${game.region}`;
  const [src, setSrc] = useState(() => {
    const cached = resolvedCache.get(key);
    if (cached !== undefined) return cached || null;
    return undefined; // not yet resolved
  });

  // Track whether this component instance is still mounted.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Already resolved from cache on mount
    if (src !== undefined) return;

    let cancelled = false;

    (async () => {
      // If another instance already kicked off a probe, piggy-back on it.
      let probe = inflightProbes.get(key);
      if (!probe) {
        const candidates = buildCandidates(game);
        if (candidates.length === 0) {
          resolvedCache.set(key, false);
          if (!cancelled && mountedRef.current) setSrc(null);
          return;
        }
        probe = resolveThumb(key, candidates);
        inflightProbes.set(key, probe);
      }

      const result = await probe;
      inflightProbes.delete(key);

      if (!cancelled && mountedRef.current) {
        setSrc(result || null);
      }
    })();

    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    src,
    loaded: src !== undefined,
  };
}

export default useThumbnail;
