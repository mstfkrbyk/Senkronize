import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { TataCliqAdapter } from './tata-cliq.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [TataCliqAdapter],
  exports: [TataCliqAdapter],
})
export class TataCliqModule {}
