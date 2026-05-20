import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { RossmannTrAdapter } from './rossmann-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [RossmannTrAdapter],
  exports: [RossmannTrAdapter],
})
export class RossmannTrModule {}
