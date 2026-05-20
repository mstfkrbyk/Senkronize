import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { FirstdibsAdapter } from './firstdibs.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [FirstdibsAdapter],
  exports: [FirstdibsAdapter],
})
export class FirstdibsModule {}
