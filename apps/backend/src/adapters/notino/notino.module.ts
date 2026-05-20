import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { NotinoAdapter } from './notino.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [NotinoAdapter],
  exports: [NotinoAdapter],
})
export class NotinoModule {}
