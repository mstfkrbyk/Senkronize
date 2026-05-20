import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { IndiamartAdapter } from './indiamart.adapter';

@Module({
  imports: [CommonModule],
  providers: [IndiamartAdapter],
  exports: [IndiamartAdapter],
})
export class IndiamartModule {}
