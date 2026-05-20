import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { SwappaAdapter } from './swappa.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [SwappaAdapter],
  exports: [SwappaAdapter],
})
export class SwappaModule {}
