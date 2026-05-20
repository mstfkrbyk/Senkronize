import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { InstacartAdapter } from './instacart.adapter';

@Module({
  imports: [CommonModule],
  providers: [InstacartAdapter],
  exports: [InstacartAdapter],
})
export class InstacartModule {}
