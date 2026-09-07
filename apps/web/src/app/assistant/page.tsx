'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  History,
  Incognito,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  X,
} from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { invalidateAfterAgentMutations } from '@/lib/agent-cache';
import {
  type SavedMessage,
  type ThreadSummary,
  createThread,
  deleteThread,
  listThreads,
  loadThread,
} from '@/lib/chat-store';
interface Status { provider: string; live: boolean }
interface ChatAction { tool: string; label: string; summary: string; mutated: boolean }
interface ChatReply { reply: string; actions: ChatAction[]; provider: string; live: boolean; conversationId?: string }

type Panel = 'history' | null;
interface Attachment { name: string; dataUrl: string }

/** Strip any accidental raw JSON fragments a model reply may contain. */
function cleanContent(text: string): string {
  if (!text.includes('{')) return text;
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (token.includes('{') && /\{\s*"(?:id|businessId|name|sku)"\s*:/.test(token)) {
        return '[data]';
      }
      return token;
    })
    .join('');
}

export default function AssistantPage() {
  return (
    <AppShell>
      <AssistantContent />
    </AppShell>
  );
}

function AssistantContent() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const status = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => api.get<Status>('/ai/status', { accessToken: token }),
    enabled: !!token,
  });

  return <AssistantWorkspace token={token} live={status.data?.live ?? false} provider={status.data?.provider} />;
}

function AssistantWorkspace({ token, live, provider }: { token?: string; live: boolean; provider?: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [messages, setMessages] = React.useState<SavedMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [attachment, setAttachment] = React.useState<Attachment | null>(null);
  // Server-owned private thread for this user + shop; null until the first
  // saved turn creates it (incognito never creates one).
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [incognito, setIncognito] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const threads = useQuery({
    queryKey: ['ai', 'threads'],
    queryFn: () => listThreads(token),
    enabled: !!token,
  });

  // One-time cleanup: drop the legacy device-local thread pools. Threads now
  // live server-side per user, so the old shared browser copies must go.
  React.useEffect(() => {
    try {
      window.localStorage.removeItem('beaver.chat.history');
      window.localStorage.removeItem('beaver.chat.archive');
    } catch {
      /* storage unavailable — nothing to clean */
    }
  }, []);

  const mutation = useMutation({
    mutationFn: ({ text, images, convId }: { text: string; images?: string[]; convId: string | null }) =>
      api.post<ChatReply>(
        '/ai/chat',
        {
          // Only the newest turn travels; history loads server-side from the
          // caller's own thread (or nothing at all in incognito mode).
          messages: [{ content: text, images }],
          ...(convId ? { conversationId: convId } : {}),
        },
        { accessToken: token },
      ),
    onSuccess: (data) => {
      invalidateAfterAgentMutations(qc, data.actions ?? []);
      if (data.conversationId && data.conversationId !== threadId) setThreadId(data.conversationId);
      qc.invalidateQueries({ queryKey: ['ai', 'threads'] });
      setMessages((m) => [
        ...m,
        { role: 'user', content: inputAtSend.current, images: imageAtSend.current },
        {
          role: 'assistant',
          content: data.reply,
          actions: data.actions && data.actions.length > 0 ? data.actions : undefined,
        },
      ]);
      setInput('');
      setAttachment(null);
    },
  });
  const inputAtSend = React.useRef('');
  const imageAtSend = React.useRef<string[] | undefined>(undefined);

  const submit = async (raw: string) => {
    const base = raw.trim();
    const images = attachment ? [attachment.dataUrl] : undefined;
    const attachedNote = attachment ? t('assistant.attach.note', { name: attachment.name }) : '';
    const message = [base, attachedNote].filter(Boolean).join('\n\n');
    if ((!message.trim() && !images) || mutation.isPending) return;
    // First saved turn opens the private server thread; incognito stays stateless.
    let convId = threadId;
    if (!incognito && !convId && token) {
      try {
        const thread = await createThread(token);
        convId = thread.id;
        setThreadId(thread.id);
      } catch {
        convId = null; // fall back to a stateless turn rather than losing the question
      }
    }
    inputAtSend.current = message;
    imageAtSend.current = images;
    setInput('');
    setAttachment(null);
    mutation.mutate({ text: message, images, convId: incognito ? null : convId });
  };

  const scrollToBottom = React.useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);
  React.useEffect(() => {
    scrollToBottom();
  }, [messages, mutation.isPending, scrollToBottom]);

  const newChat = React.useCallback(() => {
    setMessages([]);
    setInput('');
    setAttachment(null);
    setThreadId(null);
  }, []);

  const resumeThread = React.useCallback(
    async (id: string) => {
      try {
        const msgs = await loadThread(token, id);
        setThreadId(id);
        setMessages(msgs);
      } catch {
        // Thread gone (or never ours) — stay on the current view.
      }
      setPanel(null);
    },
    [token],
  );

  const removeThread = React.useCallback(
    async (id: string) => {
      try {
        await deleteThread(token, id);
      } catch {
        // Already gone — treat as deleted.
      }
      if (id === threadId) newChat();
      qc.invalidateQueries({ queryKey: ['ai', 'threads'] });
    },
    [token, threadId, newChat, qc],
  );

  const incognitoToggle = () => {
    setIncognito((v) => !v);
    // Entering incognito clears the working thread; leaving just stops saving.
    if (!incognito) {
      newChat();
    }
  };

  const pickAttachment = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  };

  const rightPanel = panel ? (
    <SidePanel
      currentId={threadId}
      threads={threads.data ?? []}
      loading={threads.isLoading}
      onNewChat={newChat}
      onResume={resumeThread}
      onDelete={removeThread}
      onClose={() => setPanel(null)}
    />
  ) : null;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <ChatHeader
        live={live}
        provider={provider}
        incognito={incognito}
        panel={panel}
        onTogglePanel={setPanel}
        onToggleIncognito={incognitoToggle}
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Main chat column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!live && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs leading-relaxed text-amber-800 sm:text-sm">
              {t('assistant.offlineBanner')}
            </div>
          )}
          {incognito && (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs font-medium text-amber-800">
              <Incognito className="size-4" />
              {t('assistant.incognitoOn')}
              <button
                type="button"
                onClick={incognitoToggle}
                className="ml-auto font-semibold underline underline-offset-2 hover:text-amber-900"
              >
                {t('assistant.clearThread')}
              </button>
            </div>
          )}

          {/* Scrollable message area / centered hero */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 && !mutation.isPending ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Sparkles className="size-8" />
                </span>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{t('assistant.title')}</h1>
                <p className="mt-2 max-w-md leading-relaxed text-slate-500">{t('assistant.subtitle')}</p>
                <div className="mt-8 flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="tap rounded-full border border-hairline px-3.5 py-2 text-sm text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4 px-1 py-4">
                {messages.map((m, idx) => (
                  <div key={idx} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed',
                        m.role === 'user'
                          ? 'rounded-br-sm bg-brand-600 text-white'
                          : 'rounded-bl-sm bg-slate-100 text-slate-700',
                      )}
                    >
                      {m.images && m.images.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {m.images.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element -- base64 preview from the client
                            <img
                              key={i}
                              src={src}
                              alt=""
                              className="max-h-40 max-w-56 rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {m.actions && m.actions.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {m.actions.map((a, ai) => (
                            <div
                              key={ai}
                              className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/50 px-2.5 py-1.5 text-sm text-slate-700"
                            >
                              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
                              <span>
                                <span className="font-medium text-brand-700">{a.label}</span>
                                {a.summary ? <span className="text-slate-500"> — {a.summary}</span> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {cleanContent(m.content)}
                    </div>
                  </div>
                ))}
                {mutation.isPending && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-slate-500">
                      <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                        <Bot className="size-4" />
                        <span className="thinking-ring absolute inset-0 rounded-full bg-brand-400/50" />
                      </span>
                      <span className="text-sm font-medium">{t('assistant.thinking')}</span>
                      <span className="flex items-center gap-1">
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                      </span>
                    </div>
                  </div>
                )}
                {mutation.isError && (
                  <p className="text-sm text-red-600">
                    {mutation.error instanceof ApiError ? mutation.error.message : t('assistant.offline')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Composer always pinned to the bottom */}
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => submit(input)}
            disabled={mutation.isPending}
            attachment={attachment}
            onPick={(files) => pickAttachment(files)}
            onRemoveAttachment={() => setAttachment(null)}
            fileRef={fileRef}
          />
        </div>

        {rightPanel}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'What should I restock today?',
  'Which customer owes the most?',
  'How did we do profit-wise this week?',
  'Any slow-moving products to clear?',
];

function ChatHeader({
  live,
  provider,
  incognito,
  panel,
  onTogglePanel,
  onToggleIncognito,
}: {
  live: boolean;
  provider?: string;
  incognito: boolean;
  panel: Panel;
  onTogglePanel: (p: Panel) => void;
  onToggleIncognito: () => void;
}) {
  const { t } = useI18n();
  const actions: Array<{ key: Panel | 'incognito'; icon: typeof Bot; label: string; active: boolean; onClick: () => void }> = [
    {
      key: 'incognito',
      icon: Incognito,
      label: t('assistant.incognito'),
      active: incognito,
      onClick: onToggleIncognito,
    },
    {
      key: 'history',
      icon: History,
      label: t('assistant.history.title'),
      active: panel === 'history',
      onClick: () => onTogglePanel(panel === 'history' ? null : 'history'),
    },
  ];

  return (
    <header className="flex items-center justify-between gap-3 border-b border-hairline py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Bot className="size-5" />
        </span>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="size-4 text-brand-600" />
            {t('assistant.title')}
          </p>
          <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className={cn('size-1.5 rounded-full', live ? 'bg-brand-500' : 'bg-amber-400')} />
            {live ? `${t('assistant.live')}${provider ? ` · ${provider}` : ''}` : t('assistant.offline')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {actions.map((a) => (
          <button
            key={String(a.key)}
            type="button"
            onClick={a.onClick}
            className={cn(
              'tap grid size-10 place-items-center rounded-xl transition-colors',
              a.active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            )}
            title={a.label}
            aria-label={a.label}
          >
            <a.icon className="size-5" />
          </button>
        ))}
      </div>
    </header>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  attachment,
  onPick,
  onRemoveAttachment,
  fileRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  attachment: Attachment | null;
  onPick: (files: FileList | null) => void;
  onRemoveAttachment: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { t } = useI18n();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="border-t border-hairline py-3"
    >
      <div className="mx-auto max-w-3xl">
        {attachment && (
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-hairline bg-slate-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from client-picked file */}
            <img src={attachment.dataUrl} alt={attachment.name} className="size-11 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{attachment.name}</span>
            <button
              type="button"
              onClick={onRemoveAttachment}
              className="tap rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title={t('assistant.attach.remove')}
              aria-label={t('assistant.attach.remove')}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface px-2 py-1.5 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title={t('assistant.attach')}
            aria-label={t('assistant.attach')}
          >
            <Paperclip className="size-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('assistant.placeholder')}
            autoComplete="off"
            className="h-9 min-w-0 flex-1 bg-transparent px-1 text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={(!value.trim() && !attachment) || disabled}
            className="tap grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
            aria-label={t('assistant.send')}
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </form>
  );
}

function SidePanel({
  currentId,
  threads,
  loading,
  onNewChat,
  onResume,
  onDelete,
  onClose,
}: {
  currentId: string | null;
  threads: ThreadSummary[];
  loading: boolean;
  onNewChat: () => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="size-4 text-slate-400" />
          {t('assistant.history.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="tap grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={t('app.closeMenu')}
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          className="tap mb-2 flex w-full items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          <span>{t('assistant.history.newChat')}</span>
          <Send className="size-4" />
        </button>

        {loading ? (
          <p className="px-3 py-8 text-center text-sm text-slate-400">{t('assistant.history.loading')}</p>
        ) : threads.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-400">{t('assistant.history.empty')}</p>
        ) : (
          <ul className="space-y-1">
            {threads.map((c) => {
              const isCurrent = c.id === currentId;
              return (
                <li key={c.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onResume(c.id)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      isCurrent ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.title || t('assistant.history.noTitle')}</span>
                      <span className="block truncate text-xs text-slate-400">{shortTime(c.updatedAt)}</span>
                    </span>
                    <span className="size-3 shrink-0 rounded-full" />
                  </button>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      className="tap grid size-8 shrink-0 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      title={t('assistant.clearThread')}
                      aria-label={t('assistant.clearThread')}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function shortTime(ts: string | number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
