import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MercariAdapter } from './mercari.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MercariAdapter],
  exports: [MercariAdapter],
})
export class MercariModule {}
