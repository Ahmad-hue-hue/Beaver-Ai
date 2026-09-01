import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AI_PROVIDER } from '../../common/ai/ai.constants.js';
import type { AiProvider, ChatMessage, ToolCall } from '../../common/ai/ai.provider.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { AgentsService } from './agents.service.js';
import { AgentToolRegistry } from './tools/registry.js';

const money = (v: Prisma.Decimal | string | number): string => {
  const d = new Prisma.Decimal(String(v));
  return `TZS ${d.toDecimalPlaces(0).toString()}`;
};

/**
 * Safety net: strip any incidental raw JSON fragments the model may have echoed
 * back into its reply (e.g. a tool result like {"id":"…","businessId":"…"}).
 * Collapses them into a short, readable marker so raw data never surfaces to the user.
 */
function scrubReply(text: string): string {
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

/** One action the agent performed, surfaced to the user. */
export interface AgentAction {
  tool: string;
  label: string;
  summary: string;
  mutated: boolean;
}

export interface AgentReply {
  reply: string;
  actions: AgentAction[];
  steps: number;
}

const MAX_STEPS = 6;

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly agents: AgentsService,
    private readonly registry: AgentToolRegistry,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  get isLive(): boolean {
    return this.provider.isLive;
  }

  /** Deterministic, always-on proactive insights (no model required). */
  insights(businessId: string, limit?: number) {
    return this.agents.insights(businessId, { limit });
  }

  /**
   * Autonomous agent chat. Grounds the model in a live business snapshot, then lets it call
   * business-scoped tools (create products, record sales, adjust stock, …) until it produces a
   * final answer. All tool calls run as `actor` scoped to `businessId` from the JWT.
   */
  async chat(businessId: string, actor: AuthenticatedUser, history: ChatMessage[]): Promise<AgentReply> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    const context = await this.contextSnapshot(businessId);
    const tools = this.registry.definitions();

    const system: ChatMessage = {
      role: 'system',
      content:
        `You are Beaver, the autonomous assistant embedded in the business operating system for ` +
        `“${business?.name ?? 'this shop'}”, a small Tanzanian retail shop. Answer in the user's language ` +
        `(Kiswahili or English), be concise, practical and specific. Money is in TZS.\n\n` +
        `You can take real actions on the business by calling tools (e.g. create_product, record_sale, ` +
        `record_expense, adjust_stock, record_debt_payment, create_customer). When the user asks you to do ` +
        `something, figure out what's needed (look up ids first with the list_* tools when you don't know them), ` +
        `then call the tools. Only use data that is real — never invent figures or ids. If you don't have enough ` +
        `information, ask the user. When you're done, give a short summary of what you did and the results.\n\n` +
        `Here is a live snapshot of the business:\n${context}`,
    };

    const messages: ChatMessage[] = [system, ...history];
    const actions: AgentAction[] = [];
    let steps = 0;

    for (;;) {
      const result = await this.provider.complete({
        messages,
        tools,
        maxOutputTokens: 900,
        temperature: 0.4,
      });

      if (result.toolCalls.length === 0) {
        const reply = scrubReply(result.text || 'Done.');
        return { reply, actions, steps };
      }

      if (steps >= MAX_STEPS) {
        return {
          reply:
            scrubReply(result.text) ||
            'I took several actions but hit my step limit. Here is where things stand — let me know if you want me to continue.',
          actions,
          steps,
        };
      }

      steps += 1;
      messages.push({
        role: 'assistant',
        content: result.text,
        toolCalls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        const outcome = await this.runTool(call, businessId, actor);
        if (outcome) {
          actions.push({
            tool: call.name,
            label: outcome.label,
            summary: summarizeOutcome(call.name, outcome.output),
            mutated: outcome.mutated,
          });
        }
        messages.push({
          role: 'tool',
          name: call.id,
          content: outcome?.output ?? `Success: ${call.name} completed.`,
        });
      }
    }
  }

  private async runTool(
    call: ToolCall,
    businessId: string,
    actor: AuthenticatedUser,
  ): Promise<{ label: string; output: string; mutated: boolean } | null> {
    try {
      return await this.registry.execute(call, {
        businessId,
        actor,
        meta: { userAgent: 'beaver-agent', ip: undefined },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { label: call.name, output: `Error: ${message}`, mutated: false };
    }
  }

  private async contextSnapshot(businessId: string): Promise<string> {
    const [overview, stats, insights] = await Promise.all([
      this.analytics.overview(businessId).catch(() => null),
      this.analytics.stats(businessId, 'today').catch(() => null),
      this.agents.insights(businessId, { limit: 5 }),
    ]);

    const lines: string[] = [];
    if (stats) {
      lines.push(
        `Today: ${stats.salesCount} sale(s), revenue ${money(stats.revenue)}, gross profit ${money(stats.grossProfit)}, ` +
          `expenses ${money(stats.expenses)}, net ${money(stats.netProfit)} (${stats.marginPct}% margin).`,
      );
    }
    if (overview) {
      lines.push(
        `Cash in hand: ${money(overview.cashInHand)}. Customers owe ${money(overview.debtOutstanding)}. ` +
          `Stock value ${money(overview.inventory.stockValue)} (${overview.inventory.lowStock} low).`,
      );
    }
    if (insights.length) {
      lines.push('Current flags: ' + insights.map((i) => `${i.title} — ${i.body}`).join(' | '));
    }
    return lines.join('\n') || 'No business data recorded yet.';
  }
}

/** A short, self-contained one-line summary of a tool result for the transcript. */
function summarizeOutcome(name: string, output: string): string {
  if (/^Error:/.test(output)) return output;
  if (/create_product|update_product/.test(name)) return 'Product saved.';
  if (/create_customer/.test(name)) return 'Customer added.';
  if (/create_supplier/.test(name)) return 'Supplier added.';
  if (/record_sale/.test(name)) return 'Sale recorded.';
  if (/void_sale/.test(name)) return 'Sale voided.';
  if (/record_purchase/.test(name)) return 'Purchase order created (draft).';
  if (/receive_purchase/.test(name)) return 'Purchase received, stock updated.';
  if (/record_expense/.test(name)) return 'Expense recorded.';
  if (/record_debt_payment/.test(name)) return 'Debt payment recorded.';
  if (/adjust_stock|receive_stock|write_off_stock/.test(name)) return 'Stock updated.';
  if (/create_category/.test(name)) return 'Category created.';
  if (/create_unit/.test(name)) return 'Unit created.';
  const t = output.replace(/\s+/g, ' ').trim();
  return t.length > 160 ? `${t.slice(0, 160)}…` : t;
}
