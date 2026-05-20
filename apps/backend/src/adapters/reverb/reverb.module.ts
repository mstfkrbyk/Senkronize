import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ReverbAdapter } from './reverb.adapter';

@Module({
  imports: [CommonModule],
  providers: [ReverbAdapter],
  exports: [ReverbAdapter],
})
export class ReverbModule {}
