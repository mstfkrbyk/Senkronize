import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { BerealShopAdapter } from './bereal-shop.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [BerealShopAdapter],
  exports: [BerealShopAdapter],
})
export class BerealShopModule {}
