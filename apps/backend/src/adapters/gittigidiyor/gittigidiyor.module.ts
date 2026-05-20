import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GittigidiyorAdapter } from './gittigidiyor.adapter';

@Module({
  imports: [CommonModule],
  providers: [GittigidiyorAdapter],
  exports: [GittigidiyorAdapter],
})
export class GittigidiyorModule {}
