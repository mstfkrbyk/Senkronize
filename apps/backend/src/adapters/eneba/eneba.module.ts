import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { EnebaAdapter } from './eneba.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [EnebaAdapter],
  exports: [EnebaAdapter],
})
export class EnebaModule {}
