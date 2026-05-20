import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { DecluttrAdapter } from './decluttr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [DecluttrAdapter],
  exports: [DecluttrAdapter],
})
export class DecluttrModule {}
