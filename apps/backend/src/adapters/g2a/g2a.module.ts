import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { G2aAdapter } from './g2a.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [G2aAdapter],
  exports: [G2aAdapter],
})
export class G2aModule {}
