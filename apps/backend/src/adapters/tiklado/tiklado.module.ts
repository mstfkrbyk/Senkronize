import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { TikladoAdapter } from './tiklado.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [TikladoAdapter],
  exports: [TikladoAdapter],
})
export class TikladoModule {}
