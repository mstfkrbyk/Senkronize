import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { JoomAdapter } from './joom.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [JoomAdapter],
  exports: [JoomAdapter],
})
export class JoomModule {}
