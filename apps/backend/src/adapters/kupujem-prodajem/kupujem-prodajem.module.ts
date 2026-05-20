import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KupujemProdajemAdapter } from './kupujem-prodajem.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KupujemProdajemAdapter],
  exports: [KupujemProdajemAdapter],
})
export class KupujemProdajemModule {}
