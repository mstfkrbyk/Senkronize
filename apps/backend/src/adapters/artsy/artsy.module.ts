import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ArtsyAdapter } from './artsy.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ArtsyAdapter],
  exports: [ArtsyAdapter],
})
export class ArtsyModule {}
