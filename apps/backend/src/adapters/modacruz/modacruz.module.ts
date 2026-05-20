import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ModacruzAdapter } from './modacruz.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ModacruzAdapter],
  exports: [ModacruzAdapter],
})
export class ModacruzModule {}
