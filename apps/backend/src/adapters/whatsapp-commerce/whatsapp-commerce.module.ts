import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { WhatsappCommerceAdapter } from './whatsapp-commerce.adapter';

@Module({
  imports: [CommonModule],
  providers: [WhatsappCommerceAdapter],
  exports: [WhatsappCommerceAdapter],
})
export class WhatsappCommerceModule {}
