import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { BauhausTrAdapter } from './bauhaus-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [BauhausTrAdapter],
  exports: [BauhausTrAdapter],
})
export class BauhausTrModule {}
