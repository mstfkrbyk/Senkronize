import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { JuspayAdapter } from './juspay.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [JuspayAdapter],
  exports: [JuspayAdapter],
})
export class JuspayModule {}
