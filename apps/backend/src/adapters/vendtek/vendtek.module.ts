import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { VendtekAdapter } from './vendtek.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [VendtekAdapter],
  exports: [VendtekAdapter],
})
export class VendtekModule {}
