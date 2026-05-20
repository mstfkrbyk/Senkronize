import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ShukranAdapter } from './shukran.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ShukranAdapter],
  exports: [ShukranAdapter],
})
export class ShukranModule {}
