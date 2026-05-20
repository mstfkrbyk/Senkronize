import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { LinensNThingsAdapter } from './linens-n-things.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [LinensNThingsAdapter],
  exports: [LinensNThingsAdapter],
})
export class LinensNThingsModule {}
