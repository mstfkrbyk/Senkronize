import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { XShoppingAdapter } from './x-shopping.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [XShoppingAdapter],
  exports: [XShoppingAdapter],
})
export class XShoppingModule {}
