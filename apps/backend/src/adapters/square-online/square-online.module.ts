import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { SquareOnlineAdapter } from './square-online.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [SquareOnlineAdapter],
  exports: [SquareOnlineAdapter],
})
export class SquareOnlineModule {}
