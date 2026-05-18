import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { RobomarktAdapter } from './robomarkt.adapter';

@Module({
  imports: [CommonModule],
  providers: [RobomarktAdapter],
  exports: [RobomarktAdapter],
})
export class RobomarktModule {}
