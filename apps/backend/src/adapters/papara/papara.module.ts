import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PaparaAdapter } from './papara.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [PaparaAdapter],
  exports: [PaparaAdapter],
})
export class PaparaModule {}
