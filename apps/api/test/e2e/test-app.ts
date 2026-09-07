import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter.js';

/**
 * Boots a real NestJS app against live Postgres + Redis (DATABASE_URL, REDIS_HOST/PORT
 * must be set in the environment). Tears it down after all tests. Every call creates
 * a fully isolated module tree — separate Prisma clients, cache, everything — so tests
 * can run in parallel if needed.
 */
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();

  // Mirror the global behaviour of main.ts so routes + guards behave the same in tests.
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

  await app.init();
  return app;
}