import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AboutYouAdapter } from './about-you.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [AboutYouAdapter],
  exports: [AboutYouAdapter],
})
export class AboutYouModule {}
