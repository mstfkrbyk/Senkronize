import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { CraftsvillaAdapter } from './craftsvilla.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [CraftsvillaAdapter],
  exports: [CraftsvillaAdapter],
})
export class CraftsvillaModule {}
