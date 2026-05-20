import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { WatsonsTrAdapter } from './watsons-tr.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [WatsonsTrAdapter],
  exports: [WatsonsTrAdapter],
})
export class WatsonsTrModule {}
