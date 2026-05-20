import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { WishAdapter } from './wish.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [WishAdapter],
  exports: [WishAdapter],
})
export class WishModule {}
