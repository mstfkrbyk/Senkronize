import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ShowroompriveAdapter } from './showroomprive.adapter';

@Module({
  imports: [CommonModule],
  providers: [ShowroompriveAdapter],
  exports: [ShowroompriveAdapter],
})
export class ShowroompriveModule {}
