import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { IherbAdapter } from './iherb.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [IherbAdapter],
  exports: [IherbAdapter],
})
export class IherbModule {}
