// API client (§3.9). Attaches the bearer token (from IndexedDB) to every request,
// points at '/api'. Mirrors the server DTOs (packages/core zod / data/items.ts).
import { getToken } from './idb.ts';

export type ItemStatus = 'new' | 'queued' | 'ignored' | 'saved';

export interface TagDto {
  slug: string;
  label: string;
  kind: string;
}

export interface ItemListDto {
  id: string;
  externalId: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: number | null;
  ingestedAt: number;
  source: { id: string; slug: string; title: string; type: string };
  status: ItemStatus;
  tags: TagDto[];
  hasSummary: boolean;
}

export interface NoteDto {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface SummaryDto {
  id: string;
  model: string;
  promptVersion: string;
  inputKind: string;
  body: string;
  generatedAt: number;
}

export interface ItemDetailDto extends ItemListDto {
  notes: NoteDto[];
  summaries: SummaryDto[];
}

export interface SourceDto {
  id: string;
  slug: string;
  title: string;
  type: string;
  active: boolean;
  lastPolledAt: number | null;
  lastStatus: string | null;
  lastError: string | null;
}

export class UnauthorizedError extends Error {}
export class OfflineError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    // Network unreachable (offline). Mutations surface this; reads fall back to SW cache.
    throw new OfflineError('offline — could not reach the server');
  }
  if (res.status === 401) throw new UnauthorizedError('unauthorized');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ListItemsQuery {
  status?: ItemStatus;
  tag?: string;
  source?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export const api = {
  async health(): Promise<boolean> {
    try {
      const r = await fetch('/api/healthz');
      return r.ok;
    } catch {
      return false;
    }
  },

  listItems(query: ListItemsQuery = {}): Promise<{ items: ItemListDto[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    return request(`/items${qs ? `?${qs}` : ''}`);
  },

  getItem(id: string): Promise<ItemDetailDto> {
    return request(`/items/${id}`);
  },

  setState(id: string, status: ItemStatus): Promise<unknown> {
    return request(`/items/${id}/state`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  addTag(id: string, label: string): Promise<TagDto> {
    return request(`/items/${id}/tags`, { method: 'POST', body: JSON.stringify({ label }) });
  },

  removeTag(id: string, tagSlug: string): Promise<void> {
    return request(`/items/${id}/tags/${tagSlug}`, { method: 'DELETE' });
  },

  addNote(id: string, body: string): Promise<NoteDto> {
    return request(`/items/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) });
  },

  updateNote(noteId: string, body: string): Promise<NoteDto> {
    return request(`/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  },

  deleteNote(noteId: string): Promise<void> {
    return request(`/notes/${noteId}`, { method: 'DELETE' });
  },

  getSummary(id: string): Promise<SummaryDto> {
    return request(`/items/${id}/summary`);
  },

  generateSummary(id: string, regenerate = false): Promise<SummaryDto & { cached: boolean }> {
    return request(`/items/${id}/summary${regenerate ? '?regenerate=true' : ''}`, { method: 'POST' });
  },

  listSources(): Promise<SourceDto[]> {
    return request('/sources');
  },

  syncSources(): Promise<{ upserted: number; deactivated: number }> {
    return request('/sources/sync', { method: 'POST' });
  },

  runIngest(): Promise<{ fetched: number; created: number; errors: number }> {
    return request('/ingest/run', { method: 'POST' });
  },
};
