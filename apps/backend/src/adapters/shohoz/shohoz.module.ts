import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ShohozAdapter } from './shohoz.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ShohozAdapter],
  exports: [ShohozAdapter],
})
export class ShohozModule {}
