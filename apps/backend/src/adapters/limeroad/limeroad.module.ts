import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { LimeroadAdapter } from './limeroad.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [LimeroadAdapter],
  exports: [LimeroadAdapter],
})
export class LimeroadModule {}
