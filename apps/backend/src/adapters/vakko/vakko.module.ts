import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { VakkoAdapter } from './vakko.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [VakkoAdapter],
  exports: [VakkoAdapter],
})
export class VakkoModule {}
