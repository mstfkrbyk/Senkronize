import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ZozotownAdapter } from './zozotown.adapter';

@Module({
  imports: [CommonModule],
  providers: [ZozotownAdapter],
  exports: [ZozotownAdapter],
})
export class ZozotownModule {}
