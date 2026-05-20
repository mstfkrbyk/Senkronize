import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { BirchLaneAdapter } from './birch-lane.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [BirchLaneAdapter],
  exports: [BirchLaneAdapter],
})
export class BirchLaneModule {}
