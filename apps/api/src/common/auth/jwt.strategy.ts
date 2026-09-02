import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../config/configuration.js';
import type { AuthenticatedUser, JwtPayload } from './auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const jwt = config.get<AppConfig['jwt']>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.accessSecret,
    });
  }

  /** Return value becomes req.user. Trusts the signed token (short TTL); no DB hit. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      businessId: payload.bid,
      role: payload.role,
      permissions: payload.perms ?? [],
      isPlatformAdmin: payload.adm ?? false,
    };
  }
}
