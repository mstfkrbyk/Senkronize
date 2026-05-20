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

describe('Products E2E', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    httpServer = ctx.httpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  async function authContext() {
    const user = await registerTestUser(app);
    return user;
  }

  it('GET /products — liste (sayfalı, filtreli)', async () => {
    const { accessToken } = await authContext();
    const barcode = `869${Date.now().toString().slice(-10)}`;
    await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({ name: 'Filtre Ürün', barcode, sku: `SKU-${Date.now()}` })
      .expect(201);

    const res = await request(httpServer)
      .get('/api/v1/products')
      .query({ page: 1, limit: 10, search: 'Filtre' })
      .set(authHeader(accessToken))
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.items.some((p: { name: string }) => p.name.includes('Filtre'))).toBe(
      true,
    );
  });

  it('POST /products — ürün oluştur', async () => {
    const { accessToken } = await authContext();
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

  it('GET /products/:id — detay', async () => {
    const { accessToken } = await authContext();
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

  it('PATCH /products/:id — güncelle', async () => {
    const { accessToken } = await authContext();
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

  it('DELETE /products/:id — sil', async () => {
    const { accessToken } = await authContext();
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

  it('POST /products/:id/variants/matrix — varyant matrisi', async () => {
    const { accessToken } = await authContext();
    const barcode = `869${Date.now().toString().slice(-10)}`;
    const created = await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({ name: 'Varyant Ürün', barcode, sku: `M-${Date.now()}` })
      .expect(201);

    const res = await request(httpServer)
      .post(`/api/v1/products/${created.body.id}/variants/matrix`)
      .set(authHeader(accessToken))
      .send({
        attributes: [
          { name: 'Renk', values: ['Kırmızı', 'Mavi'] },
          { name: 'Beden', values: ['S', 'M'] },
        ],
      })
      .expect(201);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
  });

  it('GET /products/bulk/export — CSV export', async () => {
    const { accessToken } = await authContext();
    const barcode = `869${Date.now().toString().slice(-10)}`;
    await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(accessToken))
      .send({ name: 'Export Ürün', barcode })
      .expect(201);

    const res = await request(httpServer)
      .get('/api/v1/products/bulk/export')
      .query({ format: 'csv' })
      .set(authHeader(accessToken))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/csv|text/);
    expect(res.text).toContain('Export Ürün');
  });

  it('POST /products/bulk/import — CSV import', async () => {
    const { accessToken } = await authContext();
    const barcode = `869${Date.now().toString().slice(-10)}`;
    const csv =
      'barcode,name\n' +
      `${barcode},Import Ürün\n`;

    const res = await request(httpServer)
      .post('/api/v1/products/bulk/import')
      .query({ format: 'csv' })
      .set(authHeader(accessToken))
      .attach('file', Buffer.from(csv, 'utf-8'), {
        filename: 'urunler.csv',
        contentType: 'text/csv',
      })
      .expect(201);

    expect(res.body.created + res.body.updated).toBeGreaterThanOrEqual(1);

    const list = await request(httpServer)
      .get('/api/v1/products')
      .query({ search: barcode })
      .set(authHeader(accessToken))
      .expect(200);

    expect(list.body.items.some((p: { barcode: string }) => p.barcode === barcode)).toBe(
      true,
    );
  });
});
