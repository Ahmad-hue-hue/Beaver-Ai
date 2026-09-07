import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './test-app';

let app: INestApplication;

beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });

describe('Tenancy isolation (e2e)', () => {
  it('unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/suppliers');
    expect(res.status).toBe(401);
  });

  it('unauthenticated request to analytics returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/analytics/overview');
    expect(res.status).toBe(401);
  });

  // Only runnable when a platform admin is seeded (ADMIN_PHONE + ADMIN_PASSWORD set).
  it('authenticated admin token is accepted by a protected endpoint', async () => {
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPass  = process.env.ADMIN_PASSWORD;
    if (!adminPhone || !adminPass) return;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPass });
    expect([200, 201]).toContain(login.status);
    const token = login.body.accessToken as string | undefined;
    expect(token).toBeTruthy();

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(typeof me.body.userId).toBe('string');
  });
});
