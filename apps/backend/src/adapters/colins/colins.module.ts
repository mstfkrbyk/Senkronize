import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ColinsAdapter } from './colins.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ColinsAdapter],
  exports: [ColinsAdapter],
})
export class ColinsModule {}
