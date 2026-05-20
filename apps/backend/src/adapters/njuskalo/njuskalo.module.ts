import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { NjuskaloAdapter } from './njuskalo.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [NjuskaloAdapter],
  exports: [NjuskaloAdapter],
})
export class NjuskaloModule {}
