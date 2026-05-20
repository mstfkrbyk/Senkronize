import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { SportiveTrAdapter } from './sportive-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [SportiveTrAdapter],
  exports: [SportiveTrAdapter],
})
export class SportiveTrModule {}
