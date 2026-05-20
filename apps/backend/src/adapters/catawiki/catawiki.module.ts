import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { CatawikiAdapter } from './catawiki.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [CatawikiAdapter],
  exports: [CatawikiAdapter],
})
export class CatawikiModule {}
