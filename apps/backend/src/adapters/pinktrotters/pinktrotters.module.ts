import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PinktrottersAdapter } from './pinktrotters.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [PinktrottersAdapter],
  exports: [PinktrottersAdapter],
})
export class PinktrottersModule {}
