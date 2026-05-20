import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ChaldalAdapter } from './chaldal.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ChaldalAdapter],
  exports: [ChaldalAdapter],
})
export class ChaldalModule {}
