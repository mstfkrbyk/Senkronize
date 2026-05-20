import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VendureAdapter } from './vendure.adapter';

@Module({
  imports: [CommonModule],
  providers: [VendureAdapter],
  exports: [VendureAdapter],
})
export class VendureModule {}
