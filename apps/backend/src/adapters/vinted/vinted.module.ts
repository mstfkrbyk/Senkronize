import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { VintedAdapter } from './vinted.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [VintedAdapter],
  exports: [VintedAdapter],
})
export class VintedModule {}
