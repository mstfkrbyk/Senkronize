import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MiintoAdapter } from './miinto.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MiintoAdapter],
  exports: [MiintoAdapter],
})
export class MiintoModule {}
