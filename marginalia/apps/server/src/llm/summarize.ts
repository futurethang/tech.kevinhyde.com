import type { SummaryInputKind } from '@marginalia/core';

/**
 * Summarizer contract (§3.6). Phase 3 ships the STUB below; Phase 4 swaps in the
 * real Anthropic call behind this exact interface (on-demand, append-only summary
 * row, cache-unless-regenerate handled by the route). Bump PROMPT_VERSION whenever
 * the prompt changes so summary history stays interpretable.
 */

export const PROMPT_VERSION = 'v1';

export interface SummarizeInput {
  title: string;
  description: string | null;
}

export interface SummarizeResult {
  model: string;
  promptVersion: string;
  inputKind: SummaryInputKind;
  body: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export type Summarizer = (input: SummarizeInput) => Promise<SummarizeResult>;

/** Phase-3 placeholder. Returns canned text; no network, no API key needed. */
export const stubSummarizer: Summarizer = async (input) => {
  const desc = input.description?.trim() ?? '';
  const snippet = desc.length > 200 ? `${desc.slice(0, 200)}…` : desc;
  return {
    model: 'stub',
    promptVersion: PROMPT_VERSION,
    inputKind: 'metadata',
    body: [
      `STUB SUMMARY (no LLM wired yet).`,
      `Title: ${input.title}`,
      snippet ? `Notes: ${snippet}` : `No description available.`,
    ].join('\n'),
    tokensIn: null,
    tokensOut: null,
  };
};
