import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { DeliverooAdapter } from './deliveroo.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [DeliverooAdapter],
  exports: [DeliverooAdapter],
})
export class DeliverooModule {}
