import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { BaymioAdapter } from './baymio.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [BaymioAdapter],
  exports: [BaymioAdapter],
})
export class BaymioModule {}
