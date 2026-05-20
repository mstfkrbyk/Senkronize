import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { DecathlonTrAdapter } from './decathlon-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [DecathlonTrAdapter],
  exports: [DecathlonTrAdapter],
})
export class DecathlonTrModule {}
