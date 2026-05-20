import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { LookfantasticAdapter } from './lookfantastic.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [LookfantasticAdapter],
  exports: [LookfantasticAdapter],
})
export class LookfantasticModule {}
