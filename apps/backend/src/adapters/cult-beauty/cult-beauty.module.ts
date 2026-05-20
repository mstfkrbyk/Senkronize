import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { CultBeautyAdapter } from './cult-beauty.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [CultBeautyAdapter],
  exports: [CultBeautyAdapter],
})
export class CultBeautyModule {}
