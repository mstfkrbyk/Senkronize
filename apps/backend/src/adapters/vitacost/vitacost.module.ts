import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { VitacostAdapter } from './vitacost.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [VitacostAdapter],
  exports: [VitacostAdapter],
})
export class VitacostModule {}
