import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (
      typeof origin === 'string' &&
      origin.length > 0 &&
      !allowedOrigins.includes(origin)
    ) {
      return res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: `CORS: ${origin} izin verilmedi`,
      });
    }
    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} izin verilmedi`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Api-Key',
      'x-api-key',
      'x-signature',
    ],
  });

  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Senkronize API')
    .setDescription('E-ticaret entegrasyon platformu API dokümantasyonu')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Kimlik doğrulama')
    .addTag('organizations', 'Organizasyon yönetimi')
    .addTag('users', 'Kullanıcı yönetimi')
    .addTag('marketplace-connections', 'Pazaryeri bağlantıları')
    .addTag('erp-connections', 'ERP bağlantıları')
    .addTag('orders', 'Siparişler')
    .addTag('products', 'Ürünler')
    .addTag('listings', 'Listelemeler')
    .addTag('pricing', 'Fiyatlandırma ve BuyBox')
    .addTag('reports', 'Raporlar')
    .addTag('partner', 'Partner/bayi sistemi')
    .addTag('admin', 'Super admin')
    .addTag('sync', 'Senkronizasyon durumu')
    .addTag('webhooks', 'Webhook işleme')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend ${port} portunda çalışıyor`);
}

bootstrap();
