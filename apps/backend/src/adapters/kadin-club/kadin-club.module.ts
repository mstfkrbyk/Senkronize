import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KadinClubAdapter } from './kadin-club.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [KadinClubAdapter],
  exports: [KadinClubAdapter],
})
export class KadinClubModule {}
