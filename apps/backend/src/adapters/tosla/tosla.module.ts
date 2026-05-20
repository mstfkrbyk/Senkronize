import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ToslaAdapter } from './tosla.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ToslaAdapter],
  exports: [ToslaAdapter],
})
export class ToslaModule {}
