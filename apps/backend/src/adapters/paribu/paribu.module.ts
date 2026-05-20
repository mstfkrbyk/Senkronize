import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ParibuAdapter } from './paribu.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ParibuAdapter],
  exports: [ParibuAdapter],
})
export class ParibuModule {}
