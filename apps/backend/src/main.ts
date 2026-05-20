import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import compression from 'compression';
import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { initSentry } from './instrument';

async function bootstrap(): Promise<void> {
  initSentry();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = randomBytes(16).toString('base64');
    next();
  });

  const isProd = process.env.NODE_ENV === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: [
            "'self'",
            (req, res) => {
              const nonce = (res as Response & { locals: { cspNonce?: string } })
                .locals.cspNonce;
              return `'nonce-${nonce ?? ''}'`;
            },
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https://*.cloudflare.com',
            'https://*.r2.cloudflarestorage.com',
          ],
          connectSrc: [
            "'self'",
            'wss:',
            'ws:',
            'https://api.sentry.io',
            'https://app.posthog.com',
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          ...(isProd ? { upgradeInsecureRequests: [] as [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
      ...(isProd
        ? {
            hsts: {
              maxAge: 31_536_000,
              includeSubDomains: true,
              preload: true,
            },
          }
        : {}),
    }),
  );

  app.use(compression({ threshold: 1024, level: 6 }));

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
      'x-trendyol-signature',
      'x-hb-signature',
      'x-shopify-hmac-sha256',
      'x-shopify-shop-domain',
      'x-shopify-topic',
      'x-wc-webhook-signature',
      'x-wc-webhook-source',
      'x-amz-sns-message-type',
    ],
  });

  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '50mb' });

  app.setGlobalPrefix('api/v1', {
    exclude: [
      ...(process.env.NODE_ENV === 'development'
        ? [
            {
              path: 'dev/email-preview/:template',
              method: RequestMethod.GET,
            },
          ]
        : []),
    ],
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
    .setDescription(`
# Senkronize API Dokümantasyonu

Senkronize, tüm pazaryerlerinizi, ERP sistemlerinizi ve e-ticaret altyapılarınızı 
tek bir noktadan yönetmenizi sağlayan entegrasyon platformudur.

## Kimlik Doğrulama
API, iki kimlik doğrulama yöntemini destekler:
- **JWT Bearer Token**: Panel kullanıcıları için
- **API Key**: Harici entegrasyonlar için (\`sk_live_\` öneki ile)

## Rate Limiting
- Varsayılan: Dakikada 100 istek
- \`POST /auth/login\`: Dakikada 5 istek
- \`POST /auth/register\`: Saatte 3 kayıt
- \`/sync\` uçları: Dakikada 10 istek
- API anahtarları: Dakikada 60 istek (controller düzeyi)
- Webhook endpoint'leri: Sınırsız (\`SkipThrottle\`)

## Sayfalama
Liste endpoint'leri \`page\` ve \`limit\` parametrelerini destekler.
Yanıt: \`{ data: T[], total: number, page: number, limit: number }\`

## Hata Formatı
\`\`\`json
{ "statusCode": 404, "error": "Not Found", "message": "Sipariş bulunamadı" }
\`\`\`
  `)
    .setVersion('1.0.0')
    .setContact(
      'Senkronize Destek',
      'https://senkronize.com/docs',
      'api@senkronize.com',
    )
    .setLicense('Proprietary', 'https://senkronize.com/legal/terms')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
      'API-Key',
    )
    .addServer('https://api.senkronize.com', 'Production')
    .addServer('http://localhost:3001', 'Development')
    .addTag('auth', 'Kimlik doğrulama')
    .addTag('organizations', 'Organizasyon yönetimi')
    .addTag('users', 'Kullanıcı yönetimi')
    .addTag('marketplace-connections', 'Pazaryeri bağlantıları')
    .addTag('erp-connections', 'ERP bağlantıları')
    .addTag('orders', 'Siparişler')
    .addTag('products', 'Ürünler')
    .addTag('categories', 'Kategoriler')
    .addTag('product-matches', 'Ürün eşleştirme')
    .addTag('listings', 'Listelemeler')
    .addTag('pricing', 'Fiyatlandırma ve BuyBox')
    .addTag('reports', 'Raporlar')
    .addTag('cargo', 'Kargo entegrasyonları')
    .addTag('partner', 'Partner/bayi sistemi')
    .addTag('admin', 'Super admin')
    .addTag('sync', 'Senkronizasyon durumu')
    .addTag('webhooks', 'Webhook işleme')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.endsWith('docs-json')) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
    next();
  });

  Sentry.setupExpressErrorHandler(app.getHttpAdapter().getInstance());

  const port = process.env.BACKEND_PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend ${port} portunda çalışıyor`);
}

bootstrap();
