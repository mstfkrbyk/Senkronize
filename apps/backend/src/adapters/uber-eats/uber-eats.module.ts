import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { UberEatsAdapter } from './uber-eats.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [UberEatsAdapter],
  exports: [UberEatsAdapter],
})
export class UberEatsModule {}
