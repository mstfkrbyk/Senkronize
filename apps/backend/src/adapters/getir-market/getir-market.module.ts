import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { GetirMarketAdapter } from './getir-market.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [GetirMarketAdapter],
  exports: [GetirMarketAdapter],
})
export class GetirMarketModule {}
