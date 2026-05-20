import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MeqasaAdapter } from './meqasa.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MeqasaAdapter],
  exports: [MeqasaAdapter],
})
export class MeqasaModule {}
