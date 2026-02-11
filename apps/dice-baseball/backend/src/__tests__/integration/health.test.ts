import { describe, it, expect } from 'vitest';

import request from 'supertest';
import { createApp } from '../../server.js';

const describeIfNetwork = process.env.SKIP_NETWORK_TESTS === "1" ? describe.skip : describe;

describeIfNetwork('GET /health', () => {
  const { app } = createApp();

  it('returns 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('returns status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.body.status).toBe('ok');
  });

  it('returns a valid timestamp', async () => {
    const response = await request(app).get('/health');
    const timestamp = new Date(response.body.timestamp);
    expect(timestamp.getTime()).not.toBeNaN();
    // Timestamp should be recent (within last 5 seconds)
    expect(Date.now() - timestamp.getTime()).toBeLessThan(5000);
  });

  it('returns version number', async () => {
    const response = await request(app).get('/health');
    expect(response.body.version).toBe('1.0.0');
  });

  it('does not require authentication', async () => {
    // No Authorization header provided
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('returns JSON content type', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});

describeIfNetwork('GET /nonexistent', () => {
  const { app } = createApp();

  it('returns 404 for unknown endpoints', async () => {
    const response = await request(app).get('/nonexistent');
    expect(response.status).toBe(404);
  });

  it('returns proper error format', async () => {
    const response = await request(app).get('/nonexistent');
    expect(response.body).toEqual({
      error: 'not_found',
      message: 'Endpoint not found',
    });
  });
});

