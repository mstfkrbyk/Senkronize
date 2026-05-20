import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { EbayMotorsAdapter } from './ebay-motors.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [EbayMotorsAdapter],
  exports: [EbayMotorsAdapter],
})
export class EbayMotorsModule {}
