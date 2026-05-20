import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ThreadsShopAdapter } from './threads-shop.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ThreadsShopAdapter],
  exports: [ThreadsShopAdapter],
})
export class ThreadsShopModule {}
