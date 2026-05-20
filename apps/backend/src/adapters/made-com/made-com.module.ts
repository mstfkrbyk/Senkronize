import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MadeComAdapter } from './made-com.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MadeComAdapter],
  exports: [MadeComAdapter],
})
export class MadeComModule {}
