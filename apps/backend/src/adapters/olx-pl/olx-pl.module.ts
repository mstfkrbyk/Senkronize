import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { OlxPlAdapter } from './olx-pl.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [OlxPlAdapter],
  exports: [OlxPlAdapter],
})
export class OlxPlModule {}
