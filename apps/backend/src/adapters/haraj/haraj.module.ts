import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { HarajAdapter } from './haraj.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [HarajAdapter],
  exports: [HarajAdapter],
})
export class HarajModule {}
