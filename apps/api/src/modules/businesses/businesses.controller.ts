import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { PERMISSIONS } from '@beaver/shared';
import type { AppConfig } from '../../config/configuration.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { BusinessId, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import type { RequestMeta, SessionResult } from '../auth/auth.service.js';
import { BusinessesService } from './businesses.service.js';
import { OnboardBusinessDto, UpdateSettingsDto } from './dto.js';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('businesses')
@Controller()
export class BusinessesController {
  private readonly cookieCfg: AppConfig['cookie'];

  constructor(
    private readonly businesses: BusinessesService,
    config: ConfigService,
  ) {
    this.cookieCfg = config.get<AppConfig['cookie']>('cookie')!;
  }

  private meta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private refreshCookieOptions(maxAgeSeconds?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieCfg.secure,
      sameSite: 'lax',
      domain: this.cookieCfg.domain,
      path: '/api/v1/auth',
      ...(maxAgeSeconds ? { maxAge: maxAgeSeconds * 1000 } : {}),
    };
  }

  /** Sets the refresh cookie and strips the refresh token out of the JSON body. */
  private send(res: Response, result: SessionResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.refreshCookieOptions(60 * 60 * 24 * 14));
    const { refreshToken: _r, ...body } = result;
    return body;
  }

  /**
   * Onboard the caller's first (or an additional) business. Any authenticated user may do
   * this; it creates the business and re-issues a session scoped to it as OWNER.
   */
  @Post('onboarding')
  async onboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OnboardBusinessDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.businesses.onboard(user.userId, dto, this.meta(req)));
  }

  @Get('businesses/current')
  getCurrent(@BusinessId() businessId: string) {
    return this.businesses.getCurrent(businessId);
  }

  @Patch('businesses/current/settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  updateSettings(
    @BusinessId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    return this.businesses.updateSettings(businessId, user.userId, dto, this.meta(req));
  }
}
