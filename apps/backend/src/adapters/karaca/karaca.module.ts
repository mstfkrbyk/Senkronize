import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KaracaAdapter } from './karaca.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KaracaAdapter],
  exports: [KaracaAdapter],
})
export class KaracaModule {}
