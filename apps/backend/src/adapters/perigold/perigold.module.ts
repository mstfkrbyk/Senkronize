import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PerigoldAdapter } from './perigold.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [PerigoldAdapter],
  exports: [PerigoldAdapter],
})
export class PerigoldModule {}
