import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { TrendyolGroceriesAdapter } from './trendyol-groceries.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [TrendyolGroceriesAdapter],
  exports: [TrendyolGroceriesAdapter],
})
export class TrendyolGroceriesModule {}
