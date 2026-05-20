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

import {
  authHeader,
  buildRegisterDto,
  loginAndGetAccessToken,
  uniqueTaxNumber,
} from './helpers/auth.helper';
import { createTestApp } from './setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  const password = 'TestPassword123!';

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    httpServer = ctx.httpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/auth/register (POST) - başarılı kayıt', async () => {
    const dto = buildRegisterDto({
      email: `register-ok-${Date.now()}@senkronize.test`,
      password,
      taxNumber: uniqueTaxNumber(),
    });
    const res = await request(httpServer)
      .post('/api/v1/auth/register')
      .send(dto)
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('/api/v1/auth/register (POST) - tekrarlayan e-posta 409 döner', async () => {
    const email = `duplicate-${Date.now()}@senkronize.test`;
    const dto = buildRegisterDto({
      email,
      password,
      taxNumber: uniqueTaxNumber(),
    });

    await request(httpServer).post('/api/v1/auth/register').send(dto).expect(201);

    const res = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ ...dto, taxNumber: uniqueTaxNumber() })
      .expect(409);

    expect(res.body.message).toMatch(/e-posta/i);
  });

  it('/api/v1/auth/login (POST) - doğru kimlik bilgileri 200 döner', async () => {
    const email = `login-ok-${Date.now()}@senkronize.test`;
    const dto = buildRegisterDto({
      email,
      password,
      taxNumber: uniqueTaxNumber(),
    });
    await request(httpServer).post('/api/v1/auth/register').send(dto).expect(201);

    const res = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  it('/api/v1/auth/login (POST) - yanlış şifre 401 döner', async () => {
    const email = `login-fail-${Date.now()}@senkronize.test`;
    const dto = buildRegisterDto({
      email,
      password,
      taxNumber: uniqueTaxNumber(),
    });
    await request(httpServer).post('/api/v1/auth/register').send(dto).expect(201);

    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword999!' })
      .expect(401);
  });

  it('/api/v1/auth/me (GET) - JWT olmadan 401 döner', async () => {
    await request(httpServer).get('/api/v1/auth/me').expect(401);
  });

  it('/api/v1/auth/me (GET) - geçerli JWT ile kullanıcı bilgisi döner', async () => {
    const email = `me-${Date.now()}@senkronize.test`;
    const dto = buildRegisterDto({
      email,
      password,
      name: 'E2E Kullanıcı',
      taxNumber: uniqueTaxNumber(),
    });
    await request(httpServer).post('/api/v1/auth/register').send(dto).expect(201);

    const token = await loginAndGetAccessToken(app, email, password);
    const res = await request(httpServer)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
      .expect(200);

    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.name).toBe('E2E Kullanıcı');
    expect(res.body.organization).toBeDefined();
  });
});
