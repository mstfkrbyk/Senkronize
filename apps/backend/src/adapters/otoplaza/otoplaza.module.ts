import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { OtoplazaAdapter } from './otoplaza.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [OtoplazaAdapter],
  exports: [OtoplazaAdapter],
})
export class OtoplazaModule {}
