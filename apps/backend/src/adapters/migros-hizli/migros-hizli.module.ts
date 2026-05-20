import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MigrosHizliAdapter } from './migros-hizli.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MigrosHizliAdapter],
  exports: [MigrosHizliAdapter],
})
export class MigrosHizliModule {}
