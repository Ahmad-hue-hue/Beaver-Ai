'use client';

export interface SavedMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SavedMessage[];
}

const HISTORY_KEY = 'beaver.chat.history';
const ARCHIVE_KEY = 'beaver.chat.archive';
const MAX_HISTORY = 50;
const MAX_ARCHIVE = 100;

function read(key: string): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: Conversation[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — fail silently */
  }
}

export function loadHistory(): Conversation[] {
  return read(HISTORY_KEY);
}
export function loadArchive(): Conversation[] {
  return read(ARCHIVE_KEY);
}

/** Upsert a conversation into a named store (history or archive), capped by max. */
export function upsertConversation(storeKey: 'history' | 'archive', conv: Conversation): void {
  const key = storeKey === 'history' ? HISTORY_KEY : ARCHIVE_KEY;
  const max = storeKey === 'history' ? MAX_HISTORY : MAX_ARCHIVE;
  const list = read(key);
  const idx = list.findIndex((c) => c.id === conv.id);
  const next = [...list];
  if (idx >= 0) next[idx] = conv;
  else next.unshift(conv);
  write(key, next.slice(0, max));
}

/** Move (and keep) a conversation into the archive store by id. */
export function archiveConversation(id: string): void {
  const list = read(HISTORY_KEY);
  const conv = list.find((c) => c.id === id);
  if (!conv) return;
  const kept = { ...conv, updatedAt: Date.now() };
  upsertConversation('archive', kept);
  write(HISTORY_KEY, list.filter((c) => c.id !== id));
}

/** Restore an archived conversation back into the history store. */
export function restoreConversation(id: string): void {
  const list = read(ARCHIVE_KEY);
  const conv = list.find((c) => c.id === id);
  if (!conv) return;
  write(ARCHIVE_KEY, list.filter((c) => c.id !== id));
  upsertConversation('history', { ...conv, updatedAt: Date.now() });
}

export function removeFromHistory(id: string): void {
  write(HISTORY_KEY, read(HISTORY_KEY).filter((c) => c.id !== id));
}

export function clearHistory(): void {
  write(HISTORY_KEY, []);
}
export function clearArchive(): void {
  write(ARCHIVE_KEY, []);
}
