import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KhaadiAdapter } from './khaadi.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KhaadiAdapter],
  exports: [KhaadiAdapter],
})
export class KhaadiModule {}
