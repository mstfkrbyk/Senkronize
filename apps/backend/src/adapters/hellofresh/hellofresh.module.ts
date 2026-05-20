import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { HellofreshAdapter } from './hellofresh.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [HellofreshAdapter],
  exports: [HellofreshAdapter],
})
export class HellofreshModule {}
