import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { JwtStrategy } from '../../common/auth/jwt.strategy.js';
import { PermissionsGuard } from '../../common/auth/permissions.guard.js';
import { PlanFeatureGuard } from '../../common/auth/plan-feature.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    // Global guards: authenticate every route (unless @Public), then enforce permissions,
    // then enforce the premium plan-feature gate (trial bypasses).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: PlanFeatureGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
