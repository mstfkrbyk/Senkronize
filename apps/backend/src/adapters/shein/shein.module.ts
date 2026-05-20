import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { SheinAdapter } from './shein.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [SheinAdapter],
  exports: [SheinAdapter],
})
export class SheinModule {}
