import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { DarazPkAdapter } from './daraz-pk.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [DarazPkAdapter],
  exports: [DarazPkAdapter],
})
export class DarazPkModule {}
