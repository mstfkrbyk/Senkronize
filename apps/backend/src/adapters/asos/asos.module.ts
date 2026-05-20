import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AsosAdapter } from './asos.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AsosAdapter],
  exports: [AsosAdapter],
})
export class AsosModule {}
