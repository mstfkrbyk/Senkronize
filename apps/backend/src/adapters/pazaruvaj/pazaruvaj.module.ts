import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PazaruvajAdapter } from './pazaruvaj.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [PazaruvajAdapter],
  exports: [PazaruvajAdapter],
})
export class PazaruvajModule {}
