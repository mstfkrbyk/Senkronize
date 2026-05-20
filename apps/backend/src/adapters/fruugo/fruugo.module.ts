import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { FruugoAdapter } from './fruugo.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [FruugoAdapter],
  exports: [FruugoAdapter],
})
export class FruugoModule {}
