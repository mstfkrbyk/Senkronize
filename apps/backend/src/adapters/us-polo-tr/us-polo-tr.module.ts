import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { UsPoloTrAdapter } from './us-polo-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [UsPoloTrAdapter],
  exports: [UsPoloTrAdapter],
})
export class UsPoloTrModule {}
