import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { WebmotorsAdapter } from './webmotors.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [WebmotorsAdapter],
  exports: [WebmotorsAdapter],
})
export class WebmotorsModule {}
