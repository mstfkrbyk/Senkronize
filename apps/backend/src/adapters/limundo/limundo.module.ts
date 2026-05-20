import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { LimundoAdapter } from './limundo.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [LimundoAdapter],
  exports: [LimundoAdapter],
})
export class LimundoModule {}
