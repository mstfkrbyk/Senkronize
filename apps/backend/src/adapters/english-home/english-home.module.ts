import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { EnglishHomeAdapter } from './english-home.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [EnglishHomeAdapter],
  exports: [EnglishHomeAdapter],
})
export class EnglishHomeModule {}
