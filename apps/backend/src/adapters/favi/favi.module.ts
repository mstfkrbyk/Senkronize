import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { FaviAdapter } from './favi.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [FaviAdapter],
  exports: [FaviAdapter],
})
export class FaviModule {}
