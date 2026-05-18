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
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { loginAndGetAccessToken } from './helpers/auth-helper';
import { buildRegisterDto, uniqueTaxNumber } from './helpers/create-test-user';

/**
 * Tam uygulama e2e. `GET /health` gerçek DB bağlantısı dener.
 * Auth akışı Prisma şemasının (ör. `User.lockedUntil`) DB ile uyumlu olmasını gerektirir.
 */
describe('App (e2e)', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  function httpServer() {
    if (!app) {
      throw new Error('Nest uygulaması başlatılmadı');
    }
    return app.getHttpServer();
  }

  it('GET /api/v1/health → 200', () => {
    return request(httpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(['ok', 'degraded']).toContain(res.body.status);
        expect(res.body.services?.database).toMatch(/^(up|down)$/);
      });
  });

  describe('Auth Flow', () => {
    const testEmail = `test-${Date.now()}@senkronize.test`;
    const password = 'TestPassword123!';
    it('POST /api/v1/auth/register → 201', async () => {
      const dto = buildRegisterDto({
        email: testEmail,
        password,
        name: 'Test User',
        taxNumber: uniqueTaxNumber(),
      });
      const res = await request(httpServer())
        .post('/api/v1/auth/register')
        .send(dto)
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
    });

    it('POST /api/v1/auth/login → 200', async () => {
      if (!app) {
        throw new Error('Nest uygulaması başlatılmadı');
      }
      const token = await loginAndGetAccessToken(app, testEmail, password);
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(10);
    });
  });
});
