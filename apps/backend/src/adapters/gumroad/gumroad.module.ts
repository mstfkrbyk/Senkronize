import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { GumroadAdapter } from './gumroad.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [GumroadAdapter],
  exports: [GumroadAdapter],
})
export class GumroadModule {}
