import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MediamarktTrAdapter } from './mediamarkt-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MediamarktTrAdapter],
  exports: [MediamarktTrAdapter],
})
export class MediamarktTrModule {}
