import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { GardenaAdapter } from './gardena.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [GardenaAdapter],
  exports: [GardenaAdapter],
})
export class GardenaModule {}
