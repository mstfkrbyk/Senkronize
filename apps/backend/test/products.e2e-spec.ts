jest.mock('archiver', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    on: jest.fn(),
    pipe: jest.fn().mockReturnThis(),
    finalize: jest.fn(),
    append: jest.fn(),
  })),
}));

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {},
}));

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { authHeader, registerTestUser } from './helpers/auth.helper';
import { createTestApp } from './setup';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;
  let accessToken: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    httpServer = ctx.httpServer;
    const user = await registerTestUser(app);
    accessToken = user.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/products (GET) - ürün listesi döner', async () => {
    const res = await request(httpServer)
      .get('/api/v1/products')
      .set(authHeader(accessToken))
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('/api/v1/products (POST) - yeni ürün oluşturur', async () => {
    const barcode = `869${Date.now().toString().slice(-10)}`;
    const res = await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({
        name: 'E2E Test Ürünü',
        barcode,
        sku: `SKU-${Date.now()}`,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.barcode).toBe(barcode);
    expect(res.body.name).toBe('E2E Test Ürünü');
  });

  it('/api/v1/products/:id (GET) - ürün detayı döner', async () => {
    const barcode = `869${Date.now().toString().slice(-10)}`;
    const created = await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({ name: 'Detay Ürün', barcode })
      .expect(201);

    const res = await request(httpServer)
      .get(`/api/v1/products/${created.body.id}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(res.body.id).toBe(created.body.id);
    expect(res.body.barcode).toBe(barcode);
  });

  it('/api/v1/products/:id (PATCH) - ürün günceller', async () => {
    const barcode = `869${Date.now().toString().slice(-10)}`;
    const created = await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({ name: 'Güncellenecek', barcode })
      .expect(201);

    const res = await request(httpServer)
      .patch(`/api/v1/products/${created.body.id}`)
      .set(authHeader(accessToken))
      .send({ name: 'Güncellendi' })
      .expect(200);

    expect(res.body.name).toBe('Güncellendi');
  });

  it('/api/v1/products/:id (DELETE) - soft delete yapar', async () => {
    const barcode = `869${Date.now().toString().slice(-10)}`;
    const created = await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({ name: 'Silinecek', barcode })
      .expect(201);

    await request(httpServer)
      .delete(`/api/v1/products/${created.body.id}`)
      .set(authHeader(accessToken))
      .expect(200);

    await request(httpServer)
      .get(`/api/v1/products/${created.body.id}`)
      .set(authHeader(accessToken))
      .expect(404);
  });
});
