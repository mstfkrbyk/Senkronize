import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ChairishAdapter } from './chairish.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ChairishAdapter],
  exports: [ChairishAdapter],
})
export class ChairishModule {}
