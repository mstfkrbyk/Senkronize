import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { RelianceDigitalAdapter } from './reliance-digital.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [RelianceDigitalAdapter],
  exports: [RelianceDigitalAdapter],
})
export class RelianceDigitalModule {}
