import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AfterpayAdapter } from './afterpay.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AfterpayAdapter],
  exports: [AfterpayAdapter],
})
export class AfterpayModule {}
