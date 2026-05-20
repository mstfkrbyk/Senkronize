import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KlarnaMerchantAdapter } from './klarna-merchant.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KlarnaMerchantAdapter],
  exports: [KlarnaMerchantAdapter],
})
export class KlarnaMerchantModule {}
