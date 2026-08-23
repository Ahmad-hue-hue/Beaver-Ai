import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import { AuthService, type RequestMeta, type SessionResult } from './auth.service.js';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto.js';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieCfg: AppConfig['cookie'];

  constructor(
    private readonly auth: AuthService,
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

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.register(dto, this.meta(req)));
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.login(dto, this.meta(req)));
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    return this.send(res, await this.auth.refresh(token, this.meta(req)));
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
    return { success: true };
  }

  @Post('switch-business/:businessId')
  async switchBusiness(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.switchBusiness(
      user.userId,
      businessId,
      req.cookies?.[REFRESH_COOKIE],
      this.meta(req),
    );
    return this.send(res, result);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
