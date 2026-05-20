import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { GotoLkAdapter } from './goto-lk.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [GotoLkAdapter],
  exports: [GotoLkAdapter],
})
export class GotoLkModule {}
