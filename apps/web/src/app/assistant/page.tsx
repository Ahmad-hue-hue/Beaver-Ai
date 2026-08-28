'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Send, Sparkles } from '@/components/ui/icon';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
}
interface Status { provider: string; live: boolean }
interface ChatMessage { content: string }
interface ChatReply { reply: string; provider: string; live: boolean }

const SEV_STYLE: Record<Insight['severity'], { dot: string; text: string }> = {
  info: { dot: 'bg-brand-500', text: 'text-brand-700' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700' },
  critical: { dot: 'bg-red-500', text: 'text-red-700' },
};

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

  const insights = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => api.get<Insight[]>('/ai/insights?limit=12', { accessToken: token }),
    enabled: !!token,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <Sparkles className="size-6 text-brand-600" /> Assistant
          </h1>
          <p className="mt-1 text-slate-500">
            Study the business and tell you what to action next.
          </p>
        </div>
        {status.data && (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            <span className={cn('size-2 rounded-full', status.data.live ? 'bg-brand-500' : 'bg-amber-400')} />
            {status.data.live ? `live · ${status.data.provider}` : 'offline insights'}
          </span>
        )}
      </header>

      <AssistantChat token={token} />

      <section className="mt-12">
        <div className="flex items-center gap-2 border-b border-hairline pb-2">
          <Bot className="size-4 text-slate-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            What needs your attention
          </h2>
        </div>

        {insights.isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Studying your shop…</p>
        ) : insights.data?.length ? (
          <div className="mt-4 divide-y divide-hairline">
            {insights.data.map((i) => (
              <div key={i.id} className="flex gap-3 py-4">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEV_STYLE[i.severity].dot)} />
                <div className="min-w-0">
                  <p className={cn('font-medium', i.severity === 'info' ? 'text-slate-800' : SEV_STYLE[i.severity].text)}>
                    {i.title}
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-500">{i.body}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            No flags right now — the shop is looking healthy.
          </p>
        )}
      </section>

      {!insights.isLoading && insights.error && (
        <p className="mt-4 text-sm text-red-600">
          {insights.error instanceof ApiError && insights.error.status === 403
            ? 'Your role doesn’t have access to insights.'
            : 'Could not load insights.'}
        </p>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  'What should I restock today?',
  'Which customer owes the most?',
  'How did we do profit-wise this week?',
  'Any slow-moving products to clear?',
];

function AssistantChat({ token }: { token?: string }) {
  const [history, setHistory] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.post<ChatReply>('/ai/chat', { messages: [...history, { content: message }] }, { accessToken: token }),
    onSuccess: (data) => {
      setHistory((h) => [
        ...h,
        { content: input },
        { content: data.reply },
      ]);
      setInput('');
    },
  });

  const submit = (message: string) => {
    const m = message.trim();
    if (!m || mutation.isPending) return;
    mutation.mutate(m);
  };

  return (
    <div className="mt-8">
      <div className="space-y-3">
        {history.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="tap rounded-full border border-hairline px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {history.map((m, idx) => (
            <div key={idx} className={cn('flex', idx % 2 === 0 ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed',
                  idx % 2 === 0
                    ? 'rounded-br-sm bg-brand-600 text-white'
                    : 'rounded-bl-sm bg-slate-100 text-slate-700',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {mutation.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-slate-400">
                Thinking…
              </div>
            </div>
          )}
          {mutation.isError && (
            <p className="text-sm text-red-600">
              {mutation.error instanceof ApiError ? mutation.error.message : 'Could not reach the assistant.'}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="mt-4 flex items-end gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your shop…"
          className="h-12 flex-1 rounded-xl border border-hairline bg-surface px-4 text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || mutation.isPending}
          className="tap grid size-12 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-5" />
        </button>
      </form>
    </div>
  );
}
