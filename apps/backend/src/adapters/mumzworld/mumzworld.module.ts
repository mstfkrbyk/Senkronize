import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MumzworldAdapter } from './mumzworld.adapter';

@Module({
  imports: [CommonModule],
  providers: [MumzworldAdapter],
  exports: [MumzworldAdapter],
})
export class MumzworldModule {}
