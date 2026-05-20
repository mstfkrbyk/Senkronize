import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KoctasAdapter } from './koctas.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KoctasAdapter],
  exports: [KoctasAdapter],
})
export class KoctasModule {}
