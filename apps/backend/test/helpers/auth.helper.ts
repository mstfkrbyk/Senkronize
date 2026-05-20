import type { INestApplication } from '@nestjs/common';
import { OrgType } from '@prisma/client';
import request from 'supertest';

import type { RegisterDto } from '../../src/auth/auth.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

export function buildRegisterDto(
  overrides: Partial<RegisterDto> = {},
): RegisterDto {
  const suffix = Date.now().toString().slice(-6);
  return {
    email: `user-${suffix}@senkronize.test`,
    password: 'TestPassword123!',
    name: 'Test User',
    phone: '+905551112233',
    companyName: 'Test Company',
    taxNumber: `1234${suffix}`.slice(0, 10),
    taxOffice: 'Kadıköy',
    address: 'Test adres 1',
    city: 'İstanbul',
    orgType: OrgType.DIRECT,
    ...overrides,
  };
}

export function uniqueTaxNumber(): string {
  return `9${Date.now().toString().slice(-9)}`.padStart(10, '0').slice(0, 10);
}

export async function loginAndGetAccessToken(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const body = res.body as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error('Login yanıtında accessToken yok');
  }
  return body.accessToken;
}

export interface RegisteredTestUser {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  userId: string;
}

/** E2E için kayıt + token çifti döner. */
export async function registerTestUser(
  app: INestApplication,
  overrides: Partial<RegisterDto> = {},
): Promise<RegisteredTestUser> {
  const dto = buildRegisterDto(overrides);
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(dto)
    .expect(201);

  const body = res.body as {
    accessToken: string;
    refreshToken: string;
  };

  const prisma = app.get(PrismaService);
  const user = await prisma.user.findFirst({
    where: { email: dto.email.toLowerCase(), deletedAt: null },
    select: { id: true, organizationId: true },
  });
  if (!user || !user.organizationId) {
    throw new Error('Kayıt sonrası kullanıcı bulunamadı');
  }

  return {
    email: dto.email,
    password: dto.password,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    organizationId: user.organizationId,
    userId: user.id,
  };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
