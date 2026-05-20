import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GotoBusinessAdapter } from './goto-business.adapter';

@Module({
  imports: [CommonModule],
  providers: [GotoBusinessAdapter],
  exports: [GotoBusinessAdapter],
})
export class GotoBusinessModule {}
