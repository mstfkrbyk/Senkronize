import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AracimAdapter } from './aracim.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AracimAdapter],
  exports: [AracimAdapter],
})
export class AracimModule {}
