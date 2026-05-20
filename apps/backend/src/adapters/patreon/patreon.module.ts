import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PatreonAdapter } from './patreon.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [PatreonAdapter],
  exports: [PatreonAdapter],
})
export class PatreonModule {}
