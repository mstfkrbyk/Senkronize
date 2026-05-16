import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly algorithm = 'aes-256-gcm';
  private key!: Buffer;

  onModuleInit(): void {
    const hexKey = process.env.ENCRYPTION_KEY ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error(
        'ENCRYPTION_KEY geçersiz: 32 bayt (64 hex karakter) olmalıdır.',
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return (
      iv.toString('hex') +
      authTag.toString('hex') +
      encrypted.toString('hex')
    );
  }

  decrypt(ciphertext: string): string {
    const iv = Buffer.from(ciphertext.slice(0, 24), 'hex');
    const authTag = Buffer.from(ciphertext.slice(24, 56), 'hex');
    const encrypted = Buffer.from(ciphertext.slice(56), 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
  }
}
