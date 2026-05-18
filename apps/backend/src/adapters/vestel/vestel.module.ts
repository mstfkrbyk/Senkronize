import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VestelAdapter } from './vestel.adapter';

@Module({
  imports: [CommonModule],
  providers: [VestelAdapter],
  exports: [VestelAdapter],
})
export class VestelModule {}
