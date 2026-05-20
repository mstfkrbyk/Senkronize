import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { OnbuyAdapter } from './onbuy.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [OnbuyAdapter],
  exports: [OnbuyAdapter],
})
export class OnbuyModule {}
