import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { VenmoBusinessAdapter } from './venmo-business.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [VenmoBusinessAdapter],
  exports: [VenmoBusinessAdapter],
})
export class VenmoBusinessModule {}
