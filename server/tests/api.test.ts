import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('V3 API Integration Tests', () => {
  it('GET /api/v1/health should return operational status', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('operational');
  });

  it('GET /invalid-route should return 404 error response', async () => {
    const response = await request(app).get('/api/v1/nonexistent');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/events/subscriptions should require authentication', async () => {
    const response = await request(app).get('/api/v1/events/subscriptions');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
