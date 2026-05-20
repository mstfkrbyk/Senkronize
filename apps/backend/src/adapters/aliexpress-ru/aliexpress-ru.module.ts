import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AliexpressRuAdapter } from './aliexpress-ru.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AliexpressRuAdapter],
  exports: [AliexpressRuAdapter],
})
export class AliexpressRuModule {}
