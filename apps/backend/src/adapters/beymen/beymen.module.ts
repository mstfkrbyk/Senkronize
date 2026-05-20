import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { BeymenAdapter } from './beymen.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [BeymenAdapter],
  exports: [BeymenAdapter],
})
export class BeymenModule {}
