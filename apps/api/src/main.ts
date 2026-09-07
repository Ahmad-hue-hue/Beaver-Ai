import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/configuration.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const port = config.get<AppConfig['port']>('port')!;
  const corsOrigins = config.get<AppConfig['corsOrigins']>('corsOrigins')!;
  const sentryDsn = config.get<AppConfig['observability']>('observability')!.sentryDsn;

  // Error tracking is strictly opt-in: without a DSN the SDK is a no-op.
  // Exceptions are reported from AllExceptionsFilter (captures request context).
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: config.get<AppConfig['env']>('env'), tracesSampleRate: 0 });
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const pino = app.get(PinoLogger);
  app.useLogger(pino);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Beaver API')
    .setDescription('AI-powered business operating system for small/medium retail shops')
    .setVersion('0.1.0')
    .addCookieAuth('refresh_token')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  new Logger().log(`Beaver API listening on http://localhost:${port} (docs: /docs)`, 'Bootstrap');
}

void bootstrap();
