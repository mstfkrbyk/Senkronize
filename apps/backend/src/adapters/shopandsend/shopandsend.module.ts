import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ShopandsendAdapter } from './shopandsend.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ShopandsendAdapter],
  exports: [ShopandsendAdapter],
})
export class ShopandsendModule {}
