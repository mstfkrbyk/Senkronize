import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KinguinAdapter } from './kinguin.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KinguinAdapter],
  exports: [KinguinAdapter],
})
export class KinguinModule {}
