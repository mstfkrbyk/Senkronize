import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { HouzzAdapter } from './houzz.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [HouzzAdapter],
  exports: [HouzzAdapter],
})
export class HouzzModule {}
