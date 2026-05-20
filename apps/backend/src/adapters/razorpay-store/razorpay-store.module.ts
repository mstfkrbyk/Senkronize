import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { RazorpayStoreAdapter } from './razorpay-store.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [RazorpayStoreAdapter],
  exports: [RazorpayStoreAdapter],
})
export class RazorpayStoreModule {}
