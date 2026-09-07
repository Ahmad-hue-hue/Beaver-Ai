import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './test-app';

let app: INestApplication;

beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });

const PASS = 'TestPassword123!';

describe('Auth flow (e2e)', () => {
  const phone = `+255700${Date.now().toString().slice(-6)}`;

  it('POST /auth/register — creates a pending account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone, password: PASS, name: 'E2E Test User' });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.status).toBe('PENDING');
    // A new account is pending admin approval — no session/cookies issued.
    expect(res.body.accessToken).toBeUndefined();
  });

  it('POST /auth/login — rejects an unapproved account (401 ACCOUNT_PENDING)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: PASS });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_PENDING');
  });

  it('POST /auth/login — rejects a wrong password (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'WrongPassword!1' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/register — duplicate phone is rejected (409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone, password: PASS, name: 'Duplicate' });
    expect(res.status).toBe(409);
  });

  // Only runnable when a platform admin is seeded (ADMIN_PHONE + ADMIN_PASSWORD set).
  it('POST /auth/login — succeeds for the seeded platform admin (when configured)', async () => {
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPass  = process.env.ADMIN_PASSWORD;
    if (!adminPhone || !adminPass) return; // skip — no admin seeded in this env.

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPass });
    expect([200, 201]).toContain(res.status);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(20);
  });
});
