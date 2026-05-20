import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { TwistAdapter } from './twist.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [TwistAdapter],
  exports: [TwistAdapter],
})
export class TwistModule {}
