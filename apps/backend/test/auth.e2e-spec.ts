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

import { EmailService } from '../src/notifications/email/email.service';
import {
  authHeader,
  buildRegisterDto,
  loginAndGetAccessToken,
  registerTestUser,
  uniqueTaxNumber,
} from './helpers/auth.helper';
import { lockUserAccount } from './helpers/db.helper';
import { createTestApp } from './setup';

describe('Auth E2E', () => {
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

  it('POST /auth/register — başarılı kayıt', async () => {
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

  it('POST /auth/register — duplicate email hatası', async () => {
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

  it('POST /auth/login — başarılı giriş', async () => {
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

  it('POST /auth/login — yanlış şifre', async () => {
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

  it('POST /auth/login — kilitli hesap', async () => {
    const email = `locked-${Date.now()}@senkronize.test`;
    const dto = buildRegisterDto({
      email,
      password,
      taxNumber: uniqueTaxNumber(),
    });
    await request(httpServer).post('/api/v1/auth/register').send(dto).expect(201);
    await lockUserAccount(app, email);

    const res = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(401);

    expect(res.body.message).toMatch(/kilit/i);
  });

  it('GET /auth/me — JWT doğrulama', async () => {
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
    expect(res.body.organization.accountingMode).toMatch(
      /^(NATIVE|EXTERNAL_ERP)$/,
    );
    expect(Array.isArray(res.body.organization.productLines)).toBe(true);
    expect(res.body.organization.productLines.length).toBeGreaterThan(0);
    expect(res.body.organization.orgProducts).toEqual(
      res.body.organization.productLines,
    );
  });

  it('POST /auth/refresh — token yenileme', async () => {
    const user = await registerTestUser(app);
    const res = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(user.refreshToken);
  });

  it('POST /auth/logout — oturum kapatma', async () => {
    const user = await registerTestUser(app);
    await request(httpServer)
      .post('/api/v1/auth/logout')
      .set(authHeader(user.accessToken))
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('POST /auth/forgot-password — email gönderimi', async () => {
    const user = await registerTestUser(app);
    const emailSpy = jest
      .spyOn(app.get(EmailService), 'sendPasswordReset')
      .mockResolvedValue(undefined);

    const res = await request(httpServer)
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(emailSpy).toHaveBeenCalledWith(
      user.email.toLowerCase(),
      expect.stringContaining('reset-password?token='),
    );
    emailSpy.mockRestore();
  });

  it('POST /auth/2fa/setup — 2FA QR kodu', async () => {
    const user = await registerTestUser(app);
    const res = await request(httpServer)
      .post('/api/v1/auth/2fa/setup')
      .set(authHeader(user.accessToken))
      .expect(201);

    expect(res.body.secret).toBeDefined();
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes.length).toBeGreaterThan(0);
  });
});
