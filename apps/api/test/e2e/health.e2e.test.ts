import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './test-app';

let app: INestApplication;

beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });

describe('Health (e2e)', () => {
  it('GET /health (compat alias) returns 200 + status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /health/live returns 200 + uptime', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /health/ready returns 200 when DB + Redis are up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services).toEqual({ database: 'up', redis: 'up' });
  });
});
