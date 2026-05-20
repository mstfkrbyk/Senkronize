import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { OkxTrAdapter } from './okx-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [OkxTrAdapter],
  exports: [OkxTrAdapter],
})
export class OkxTrModule {}
