import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { OlxAdapter } from './olx.adapter';

@Module({
  imports: [CommonModule],
  providers: [OlxAdapter],
  exports: [OlxAdapter],
})
export class OlxModule {}
