import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { NetworkAdapter } from './network.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [NetworkAdapter],
  exports: [NetworkAdapter],
})
export class NetworkModule {}
