import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { JossMainAdapter } from './joss-main.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [JossMainAdapter],
  exports: [JossMainAdapter],
})
export class JossMainModule {}
