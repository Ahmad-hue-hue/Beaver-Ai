import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AuthService, type RequestMeta, type SessionResult } from '../auth/auth.service.js';
import { TRIAL_DAYS } from '../billing/billing.service.js';
import type { OnboardBusinessDto, UpdateSettingsDto } from './dto.js';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Create the caller's first (or an additional) business: business + settings + primary
   * branch + OWNER membership, atomically. Returns a fresh session scoped to it.
   */
  async onboard(userId: string, dto: OnboardBusinessDto, meta: RequestMeta): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const business = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          name: dto.name.trim(),
          type: dto.type,
          country: dto.country.toUpperCase(),
          currency: dto.currency.toUpperCase(),
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          taxId: dto.taxId ?? null,
          openingDate: dto.openingDate ? new Date(dto.openingDate) : null,
          trackInventory: dto.trackInventory ?? true,
          // Every new business starts a 14-day all-features trial (customer-friendly).
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
          settings: {
            create: {
              defaultPaymentMethods: dto.defaultPaymentMethods ?? ['CASH', 'MOBILE_MONEY'],
              defaultLocale: dto.defaultLocale ?? 'en',
              timezone: dto.timezone ?? 'Africa/Dar_es_Salaam',
            },
          },
          branches: { create: { name: 'Main', isPrimary: true } },
          memberships: {
            create: { userId, role: 'OWNER', status: 'ACTIVE' },
          },
        },
      });

      await this.audit.record(
        {
          businessId: created.id,
          userId,
          action: 'business.onboard',
          entityType: 'Business',
          entityId: created.id,
          after: { name: created.name, type: created.type, currency: created.currency },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );

      return created;
    });

    // Re-issue the session scoped to the new business (owner role + permissions).
    return this.auth.buildSession(user, business.id, meta);
  }

  async getCurrent(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      include: { settings: true, branches: { where: { deletedAt: null } } },
    });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  async updateSettings(businessId: string, userId: string, dto: UpdateSettingsDto, meta: RequestMeta) {
    const settings = await this.prisma.businessSettings.findUnique({ where: { businessId } });
    if (!settings) throw new BadRequestException('Business settings are not initialized.');

    const updated = await this.prisma.businessSettings.update({
      where: { businessId },
      data: {
        defaultPaymentMethods: dto.defaultPaymentMethods ?? undefined,
        defaultLocale: dto.defaultLocale ?? undefined,
        timezone: dto.timezone ?? undefined,
        receiptFooter: dto.receiptFooter ?? undefined,
        allowNegativeStock: dto.allowNegativeStock ?? undefined,
      },
    });

    await this.audit.record({
      businessId,
      userId,
      action: 'business.settings_update',
      entityType: 'BusinessSettings',
      entityId: settings.id,
      before: settings,
      after: updated,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
