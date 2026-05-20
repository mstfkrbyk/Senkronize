import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { GameflipAdapter } from './gameflip.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [GameflipAdapter],
  exports: [GameflipAdapter],
})
export class GameflipModule {}
