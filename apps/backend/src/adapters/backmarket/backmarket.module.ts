import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { BackmarketAdapter } from './backmarket.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [BackmarketAdapter],
  exports: [BackmarketAdapter],
})
export class BackmarketModule {}
