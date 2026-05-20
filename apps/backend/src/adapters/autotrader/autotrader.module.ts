import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AutotraderAdapter } from './autotrader.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AutotraderAdapter],
  exports: [AutotraderAdapter],
})
export class AutotraderModule {}
