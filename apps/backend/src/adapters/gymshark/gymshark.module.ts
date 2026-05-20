import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { GymsharkAdapter } from './gymshark.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [GymsharkAdapter],
  exports: [GymsharkAdapter],
})
export class GymsharkModule {}
