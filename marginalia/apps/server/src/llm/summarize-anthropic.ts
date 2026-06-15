import Anthropic from '@anthropic-ai/sdk';
import { PROMPT_VERSION, type SummarizeInput, type SummarizeResult, type Summarizer } from './summarize.ts';

/**
 * Real on-demand summarizer (§3.6). Builds a tight, skimmable recall summary from
 * title + description/show-notes only (input_kind='metadata') using a Haiku-tier
 * model. Implements the same Summarizer interface as stubSummarizer, so the route
 * and DB logic are unchanged. Bump PROMPT_VERSION in summarize.ts when this prompt
 * changes so summary history stays interpretable.
 *
 * // TODO: transcript source — when transcripts arrive, add a sibling summarizer
 * // with input_kind='transcript'; no schema migration needed (D2).
 */

const DEFAULT_MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = [
  'You write terse, opinionated reference notes for a senior engineer who wants to',
  'RECALL this content months later — even if the original is gone. You are given only',
  'the title and description/show-notes of a YouTube video or podcast episode (no',
  'transcript). Do not invent specifics that are not present. Output plain text in',
  'exactly this shape:',
  '',
  'TL;DR: one or two dense sentences capturing what this is about.',
  'KEY POINTS:',
  '- 3 to 5 terse bullets of the concrete topics/claims, as far as the metadata supports.',
  'WHY IT MATTERS: one sentence on when the engineer would come back to this.',
  '',
  'Be concrete and skimmable. No preamble, no marketing tone, no emoji.',
].join('\n');

export interface AnthropicSummarizerOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export function createAnthropicSummarizer(opts: AnthropicSummarizerOptions): Summarizer {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 1024;

  return async (input: SummarizeInput): Promise<SummarizeResult> => {
    const userContent = [
      `Title: ${input.title}`,
      '',
      `Description / show notes:`,
      input.description?.trim() ? input.description.trim() : '(none provided)',
    ].join('\n');

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('summary refused by model safety classifier');
    }

    const body = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!body) throw new Error('model returned an empty summary');

    return {
      model: response.model, // record the exact model that produced this row
      promptVersion: PROMPT_VERSION,
      inputKind: 'metadata',
      body,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  };
}
