'use client';

import { api } from '@/lib/api-client';

export interface SavedAction {
  tool: string;
  label: string;
  summary: string;
  mutated: boolean;
}

export interface SavedMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Optional base64 image data URLs attached to this user message. */
  images?: string[];
  /** Tool actions the assistant performed to produce this reply (agent transcript). */
  actions?: SavedAction[];
}

/** One private thread of the signed-in user in the active shop (server-owned). */
export interface ThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerMessage {
  id: string;
  role: string;
  content: string;
  images: string[] | null;
  createdAt: string;
}

/** Private thread list for this user + shop, newest first. */
export async function listThreads(token: string | undefined): Promise<ThreadSummary[]> {
  if (!token) return [];
  return api.get<ThreadSummary[]>('/ai/conversations', { accessToken: token });
}

/** Start a new private thread for this user + shop. */
export async function createThread(token: string | undefined): Promise<ThreadSummary> {
  return api.post<ThreadSummary>('/ai/conversations', {}, { accessToken: token });
}

/** Readable transcript (user + assistant turns) of an owned thread. */
export async function loadThread(token: string | undefined, id: string): Promise<SavedMessage[]> {
  const rows = await api.get<ServerMessage[]>(`/ai/conversations/${id}/messages`, { accessToken: token });
  return rows.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
    ...(m.images && m.images.length > 0 ? { images: m.images } : {}),
  }));
}

/** Delete an owned thread. */
export async function deleteThread(token: string | undefined, id: string): Promise<void> {
  await api.del(`/ai/conversations/${id}`, { accessToken: token });
}
