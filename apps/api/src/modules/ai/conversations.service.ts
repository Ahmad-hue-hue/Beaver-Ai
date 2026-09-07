import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ChatMessage } from '../../common/ai/ai.provider.js';

export interface PersistedTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  toolCalls?: unknown;
  /** Tool turns: the call id (replay wiring). */
  callId?: string;
  /** Tool turns: the tool name (readable log). */
  toolName?: string;
}

const TITLE_LEN = 48;

/**
 * Strictly private AI threads. Every query filters by BOTH the caller's
 * userId and the active businessId from the JWT — there is no code path
 * that lists or opens another user's conversation. Unknown-or-unowned ids
 * always surface as NotFound (no ownership probing).
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Own threads for (user, shop), newest first. */
  async list(userId: string, businessId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId, businessId, deletedAt: null },
      orderBy: { updatedAt: 'desc' as const },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async create(userId: string, businessId: string, title?: string) {
    return this.prisma.aiConversation.create({
      data: { userId, businessId, title: title?.trim().slice(0, 80) || 'New chat' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  /** Load an owned thread or throw NotFound (also covers foreign/deleted ids). */
  async requireOwned(userId: string, businessId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, userId, businessId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  /** Full transcript of an owned thread, oldest first. */
  async history(userId: string, businessId: string, id: string): Promise<ChatMessage[]> {
    await this.requireOwned(userId, businessId, id);
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' as const },
    });
    return rows.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
      ...(m.images ? { images: m.images as string[] } : {}),
      ...(m.toolCalls ? { toolCalls: m.toolCalls as unknown as ChatMessage['toolCalls'] } : {}),
      // Tool turns replay with the original call id so tool_call_id wiring matches.
      ...(m.role === 'tool' ? { name: m.toolCallId ?? m.toolName ?? '' } : {}),
    }));
  }

  /** Transcript shaped for the web thread view (user + assistant turns only). */
  async threadView(userId: string, businessId: string, id: string) {
    await this.requireOwned(userId, businessId, id);
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId: id, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' as const },
      select: { id: true, role: true, content: true, images: true, createdAt: true },
    });
    return rows.filter((m) => m.content.trim().length > 0 || (m.images as string[] | null)?.length);
  }

  /** Soft-delete an owned thread (messages cascade only on hard delete). */
  async remove(userId: string, businessId: string, id: string) {
    await this.requireOwned(userId, businessId, id);
    const now = new Date();
    await this.prisma.aiConversation.update({ where: { id }, data: { deletedAt: now } });
    return { id, deletedAt: now };
  }

  /**
   * Persist one user question. Titles an untitled thread from the first
   * question and touches updatedAt so the list stays newest-first.
   */
  async saveUserMessage(conversationId: string, content: string, images?: string[]) {
    const existingUsers = await this.prisma.aiMessage.count({
      where: { conversationId, role: 'user' },
    });
    const data: Prisma.AiMessageCreateManyInput = {
      conversationId,
      role: 'user',
      content,
      images: images?.length ? images : Prisma.DbNull,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.aiMessage.create({ data });
      await tx.aiConversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(existingUsers === 0 && content.trim()
            ? { title: content.trim().slice(0, TITLE_LEN) }
            : {}),
        },
      });
    });
  }

  /** Persist the assistant/tool transcript of one completed turn. */
  async saveAssistantTurn(conversationId: string, turn: PersistedTurn[]) {
    if (turn.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.aiMessage.createMany({
        data: turn.map((m) => ({
          conversationId,
          role: m.role,
          content: m.content,
          images: m.images?.length ? m.images : Prisma.DbNull,
          toolCalls: m.toolCalls !== undefined ? (m.toolCalls as Prisma.InputJsonValue) : Prisma.DbNull,
          toolCallId: m.callId ?? null,
          toolName: m.toolName ?? null,
        })),
      });
      await tx.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    });
  }
}
