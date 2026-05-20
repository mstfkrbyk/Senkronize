import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { CepteSokAdapter } from './cepte-sok.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [CepteSokAdapter],
  exports: [CepteSokAdapter],
})
export class CepteSokModule {}
