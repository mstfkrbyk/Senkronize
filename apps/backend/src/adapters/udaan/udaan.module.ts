import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { UdaanAdapter } from './udaan.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [UdaanAdapter],
  exports: [UdaanAdapter],
})
export class UdaanModule {}
