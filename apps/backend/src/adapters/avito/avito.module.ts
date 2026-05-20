import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AvitoAdapter } from './avito.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AvitoAdapter],
  exports: [AvitoAdapter],
})
export class AvitoModule {}
