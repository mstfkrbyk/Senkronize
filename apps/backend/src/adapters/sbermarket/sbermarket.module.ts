import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { SbermarketAdapter } from './sbermarket.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [SbermarketAdapter],
  exports: [SbermarketAdapter],
})
export class SbermarketModule {}
