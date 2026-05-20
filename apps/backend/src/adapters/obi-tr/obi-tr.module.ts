import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ObiTrAdapter } from './obi-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ObiTrAdapter],
  exports: [ObiTrAdapter],
})
export class ObiTrModule {}
