import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { DlgamerAdapter } from './dlgamer.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [DlgamerAdapter],
  exports: [DlgamerAdapter],
})
export class DlgamerModule {}
