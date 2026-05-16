import { randomBytes } from 'crypto';

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ImageService implements OnModuleInit {
  private readonly logger = new Logger(ImageService.name);
  private s3: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';
  private r2Enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const endpoint = this.config.get<string>('R2_ENDPOINT');
    const accessKey = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secret = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET_NAME');
    const publicUrl = this.config.get<string>('R2_PUBLIC_URL');

    const allSet = [endpoint, accessKey, secret, bucket, publicUrl].every(
      (v) => typeof v === 'string' && v.trim().length > 0,
    );

    if (!allSet) {
      this.logger.warn(
        'R2 yapılandırması eksik; görsel yükleme devre dışı (mock mod). R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME ve R2_PUBLIC_URL değerlerini ayarlayın.',
      );
      this.r2Enabled = false;
      return;
    }

    this.bucket = bucket!.trim();
    this.publicUrl = publicUrl!.trim().replace(/\/+$/, '');
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: endpoint!.trim(),
      credentials: {
        accessKeyId: accessKey!.trim(),
        secretAccessKey: secret!.trim(),
      },
    });
    this.r2Enabled = true;
  }

  isR2Enabled(): boolean {
    return this.r2Enabled;
  }

  getPublicBaseUrl(): string {
    return this.publicUrl;
  }

  private assertR2(): S3Client {
    if (!this.r2Enabled || !this.s3) {
      throw new ServiceUnavailableException(
        'Görsel depolama henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin veya yönetici ile iletişime geçin.',
      );
    }
    return this.s3;
  }

  /** @returns R2 URL veya yapılandırma yoksa `null` (iş kuyruğu sessizce tamamlanır) */
  async uploadFromUrl(
    organizationId: string,
    imageUrl: string,
    folder = 'products',
  ): Promise<string | null> {
    if (!this.r2Enabled || !this.s3) {
      this.logger.warn('R2 devre dışı; URL üzerinden görsel kopyalanmadı', {
        organizationId,
      });
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      this.logger.warn('Geçersiz görsel URL biçimi', { organizationId });
      return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      this.logger.warn('Görsel URL yalnızca http(s) olmalı', { organizationId });
      return null;
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Görsel indirilemedi: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const ext = contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const key = `${organizationId}/${folder}/${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

    const client = this.assertR2();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  async upload(
    organizationId: string,
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<string> {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Yalnızca JPEG, PNG veya WebP görselleri yüklenebilir.',
      );
    }

    const client = this.assertR2();
    const rawExt = file.originalname.split('.').pop();
    const ext =
      rawExt && /^[a-z0-9]+$/i.test(rawExt) && rawExt.length <= 8
        ? rawExt.toLowerCase()
        : file.mimetype === 'image/png'
          ? 'png'
          : file.mimetype === 'image/webp'
            ? 'webp'
            : 'jpg';
    const key = `${organizationId}/${folder}/${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  async getPresignedUrl(
    organizationId: string,
    filename: string,
  ): Promise<{ url: string; key: string }> {
    const client = this.assertR2();
    const safeName = filename.replace(/[/\\]/g, '_').slice(0, 200);
    const key = `${organizationId}/products/${Date.now()}-${safeName}`;
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(client, command, { expiresIn: 300 });
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const client = this.assertR2();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
