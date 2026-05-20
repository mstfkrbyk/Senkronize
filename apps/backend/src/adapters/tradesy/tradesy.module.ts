import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { TradesyAdapter } from './tradesy.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [TradesyAdapter],
  exports: [TradesyAdapter],
})
export class TradesyModule {}
