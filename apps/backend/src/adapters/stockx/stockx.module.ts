import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { StockxAdapter } from './stockx.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [StockxAdapter],
  exports: [StockxAdapter],
})
export class StockxModule {}
