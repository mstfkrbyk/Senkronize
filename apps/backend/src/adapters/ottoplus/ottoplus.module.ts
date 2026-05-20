import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { OttoplusAdapter } from './ottoplus.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [OttoplusAdapter],
  exports: [OttoplusAdapter],
})
export class OttoplusModule {}
