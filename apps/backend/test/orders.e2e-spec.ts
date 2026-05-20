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
import { OrderStatus } from '@prisma/client';
import request from 'supertest';

import { authHeader, loginAndGetAccessToken, registerTestUser } from './helpers/auth.helper';
import { createTestOrder } from './helpers/db.helper';
import { createTestApp } from './setup';

describe('Orders E2E', () => {
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
    const accessToken = await loginAndGetAccessToken(app, user.email, user.password);
    return { ...user, accessToken };
  }

  it('GET /orders — liste + filtreler', async () => {
    const { accessToken, organizationId } = await authContext();
    await createTestOrder(app, {
      organizationId,
      customerName: 'Filtre Müşteri',
      status: OrderStatus.NEW,
    });

    const res = await request(httpServer)
      .get('/api/v1/orders')
      .query({ page: 1, limit: 20, status: OrderStatus.NEW })
      .set(authHeader(accessToken))
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].customerName).toBe('Filtre Müşteri');
  });

  it('GET /orders/:id — detay', async () => {
    const { accessToken, organizationId } = await authContext();
    const order = await createTestOrder(app, { organizationId });

    const res = await request(httpServer)
      .get(`/api/v1/orders/${order.id}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(res.body.id).toBe(order.id);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('PATCH /orders/:id/ship — kargoya ver', async () => {
    const { accessToken, organizationId } = await authContext();
    const order = await createTestOrder(app, {
      organizationId,
      status: OrderStatus.NEW,
    });

    const res = await request(httpServer)
      .patch(`/api/v1/orders/${order.id}/ship`)
      .set(authHeader(accessToken))
      .send({
        trackingNumber: 'TRK123456789',
        cargoProvider: 'YURTICI',
      })
      .expect(200);

    expect(res.body.status).toBe(OrderStatus.SHIPPED);
    expect(res.body.cargoTrackingNumber).toBe('TRK123456789');
  });

  it('POST /orders/:id/notes — not ekle', async () => {
    const { accessToken, organizationId } = await authContext();
    const order = await createTestOrder(app, { organizationId });

    const res = await request(httpServer)
      .post(`/api/v1/orders/${order.id}/notes`)
      .set(authHeader(accessToken))
      .send({ content: 'E2E test notu', isInternal: true })
      .expect(201);

    expect(res.body.content).toBe('E2E test notu');
    expect(res.body.isInternal).toBe(true);
  });

  it('GET /orders/summary — KPI özeti', async () => {
    const { accessToken, organizationId } = await authContext();
    await createTestOrder(app, {
      organizationId,
      status: OrderStatus.NEW,
      totalAmount: 250,
    });

    const res = await request(httpServer)
      .get('/api/v1/orders/summary')
      .set(authHeader(accessToken))
      .expect(200);

    expect(typeof res.body.todayOrders).toBe('number');
    expect(typeof res.body.pendingOrders).toBe('number');
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(res.body.pendingOrders).toBeGreaterThanOrEqual(1);
  });
});
