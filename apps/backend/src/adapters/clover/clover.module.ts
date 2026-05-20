import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { CloverAdapter } from './clover.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [CloverAdapter],
  exports: [CloverAdapter],
})
export class CloverModule {}
