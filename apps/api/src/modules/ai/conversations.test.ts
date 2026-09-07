/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles: lightweight Prisma stubs, no production code affected */
import { describe, expect, test } from 'bun:test';
import { ConversationsService } from './conversations.service.js';
import { AiService } from './ai.service.js';

const UID = 'u-1';
const BID = 'b-1';

function makeConversations(db: Record<string, any> = {}) {
  const calls: any[] = [];
  const tx = {
    aiMessage: {
      create: async (args: any) => { calls.push(['message.create', args]); return { id: 'm-new', ...args.data }; },
      createMany: async (args: any) => { calls.push(['message.createMany', args]); return { count: args.data.length }; },
    },
    aiConversation: {
      update: async (args: any) => { calls.push(['conversation.update', args]); return { id: 'c-1', ...args.data }; },
    },
  };
  const prisma: any = {
    aiConversation: {
      findMany: async (args: any) => { calls.push(['conversation.findMany', args]); return db.threads ?? []; },
      findFirst: async (args: any) => { calls.push(['conversation.findFirst', args]); return db.thread ?? null; },
      create: async (args: any) => ({ id: 'c-new', ...args.data }),
      update: async (args: any) => ({ id: 'c-1', ...args.data }),
    },
    aiMessage: {
      findMany: async (args: any) => { calls.push(['message.findMany', args]); return db.messages ?? []; },
      count: async () => db.userMessageCount ?? 0,
    },
    $transaction: async (fn: any) => fn(tx),
  };
  return { svc: new ConversationsService(prisma), calls };
}

describe('ConversationsService privacy', () => {
  test('list filters by caller user + shop', async () => {
    const { svc, calls } = makeConversations({ threads: [] });
    await svc.list(UID, BID);
    const args = calls.find(([k]) => k === 'conversation.findMany')[1];
    expect(args.where).toMatchObject({ userId: UID, businessId: BID, deletedAt: null });
  });

  test('opening a foreign thread looks like missing', async () => {
    const { svc } = makeConversations({ thread: null });
    await expect(svc.requireOwned('u-2', BID, 'c-1')).rejects.toThrow('Conversation not found.');
    await expect(svc.history('u-2', BID, 'c-1')).rejects.toThrow('Conversation not found.');
    await expect(svc.remove('u-2', BID, 'c-1')).rejects.toThrow('Conversation not found.');
  });

  test('same thread id in another shop is not visible', async () => {
    // Stub returns the row only for the owning (user, shop) pair.
    const owned = { id: 'c-1', userId: UID, businessId: BID };
    const prisma: any = {
      aiConversation: {
        findFirst: async (args: any) =>
          args.where.userId === UID && args.where.businessId === BID ? owned : null,
      },
    };
    const svc = new ConversationsService(prisma);
    await expect(svc.requireOwned(UID, 'b-other', 'c-1')).rejects.toThrow('Conversation not found.');
    expect(await svc.requireOwned(UID, BID, 'c-1')).toEqual(owned);
  });

  test('history replays tool turns with the original call id', async () => {
    const { svc } = makeConversations({
      thread: { id: 'c-1' },
      messages: [
        { role: 'user', content: 'Add stock', images: null, toolCalls: null, toolCallId: null, toolName: null },
        { role: 'assistant', content: '', images: null, toolCalls: [{ id: 'call-7', name: 'list_products', arguments: '{}' }], toolCallId: null, toolName: null },
        { role: 'tool', content: 'Coke …', images: null, toolCalls: null, toolCallId: 'call-7', toolName: 'list_products' },
      ],
    });
    const history = await svc.history(UID, BID, 'c-1');
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect((history[2] as any).name).toBe('call-7');
  });

  test('first question titles an untitled thread; later ones do not retitle', async () => {
    const first = makeConversations({ userMessageCount: 0 });
    await first.svc.saveUserMessage('c-1', 'How much stock of Coke is left right now?');
    const update = first.calls.find(([k]) => k === 'conversation.update')[1];
    expect(update.data.title).toBe('How much stock of Coke is left right now?');

    const later = makeConversations({ userMessageCount: 3 });
    await later.svc.saveUserMessage('c-1', 'And what about rice?');
    const update2 = later.calls.find(([k]) => k === 'conversation.update')[1];
    expect(update2.data.title).toBeUndefined();
  });
});

describe('AiService conversation persistence', () => {
  function makeAiService() {
    const saved: any = { user: null, turn: null };
    const provider = {
      name: 'stub', isLive: false,
      complete: async () => ({ text: 'All good.', toolCalls: [] }),
    };
    const prisma: any = { business: { findUnique: async () => ({ name: 'Duka' }) } };
    const analytics: any = {
      overview: async () => null,
      stats: async () => null,
    };
    const agents: any = { insights: async () => [] };
    const registry: any = { definitions: () => [] };
    const conversations: any = {
      requireOwned: async () => ({ id: 'c-1' }),
      history: async () => [{ role: 'user', content: 'Older question' }],
      saveUserMessage: async (_id: string, content: string, images?: string[]) => {
        saved.user = { content, images };
      },
      saveAssistantTurn: async (_id: string, turn: unknown) => { saved.turn = turn; },
    };
    const svc = new AiService(provider as any, prisma, analytics, agents, registry, conversations);
    return { svc, saved };
  }

  test('chat collects the assistant transcript when asked', async () => {
    const { svc } = makeAiService();
    const actor = { userId: UID, businessId: BID, role: null, permissions: [], isPlatformAdmin: false } as any;
    const turn: any[] = [];
    const reply = await svc.chat(BID, actor, [{ role: 'user', content: 'Hi' }], turn);
    expect(reply.reply).toBe('All good.');
    expect(turn).toEqual([{ role: 'assistant', content: 'All good.' }]);
  });

  test('chatInConversation loads own history, saves question + answer', async () => {
    const { svc, saved } = makeAiService();
    const actor = { userId: UID, businessId: BID, role: null, permissions: [], isPlatformAdmin: false } as any;
    const reply = await svc.chatInConversation(BID, actor, 'c-1', 'New question');
    expect(reply.conversationId).toBe('c-1');
    expect(saved.user).toMatchObject({ content: 'New question' });
    expect(saved.turn).toEqual([{ role: 'assistant', content: 'All good.' }]);
  });

  test('chatInConversation refuses foreign threads', async () => {
    const { svc } = makeAiService();
    (svc as any).conversations.requireOwned = async () => {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Conversation not found.');
    };
    const actor = { userId: 'u-2', businessId: BID, role: null, permissions: [], isPlatformAdmin: false } as any;
    await expect(svc.chatInConversation(BID, actor, 'c-1', 'Snoop?')).rejects.toThrow('Conversation not found.');
  });
});
