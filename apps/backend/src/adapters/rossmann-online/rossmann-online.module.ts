import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { RossmannOnlineAdapter } from './rossmann-online.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [RossmannOnlineAdapter],
  exports: [RossmannOnlineAdapter],
})
export class RossmannOnlineModule {}
