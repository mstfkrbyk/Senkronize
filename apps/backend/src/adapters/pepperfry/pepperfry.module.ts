import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PepperfryAdapter } from './pepperfry.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [PepperfryAdapter],
  exports: [PepperfryAdapter],
})
export class PepperfryModule {}
