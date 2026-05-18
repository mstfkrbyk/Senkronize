import type { EncryptionService } from '../common/encryption/encryption.service';

/**
 * DB'deki webhook secret: yeni kayıtlar AES-GCM ile şifreli; eski kayıtlar düz metin olabilir.
 */
export function resolvePlainWebhookSecret(
  encryption: EncryptionService,
  stored: string | null,
): string | null {
  if (!stored) {
    return null;
  }
  try {
    return encryption.decrypt(stored);
  } catch {
    return stored;
  }
}
