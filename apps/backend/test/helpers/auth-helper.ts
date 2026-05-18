import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

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
