import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ZandoAdapter } from './zando.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ZandoAdapter],
  exports: [ZandoAdapter],
})
export class ZandoModule {}
