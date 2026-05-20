import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { Brands4lessAdapter } from './brands4less.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [Brands4lessAdapter],
  exports: [Brands4lessAdapter],
})
export class Brands4lessModule {}
