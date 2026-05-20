import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { IntersportTrAdapter } from './intersport-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [IntersportTrAdapter],
  exports: [IntersportTrAdapter],
})
export class IntersportTrModule {}
