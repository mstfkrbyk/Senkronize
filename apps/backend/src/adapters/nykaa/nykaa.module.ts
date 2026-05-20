import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { NykaaAdapter } from './nykaa.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [NykaaAdapter],
  exports: [NykaaAdapter],
})
export class NykaaModule {}
