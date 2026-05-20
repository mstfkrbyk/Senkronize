import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ToriAdapter } from './tori.adapter';

@Module({
  imports: [CommonModule],
  providers: [ToriAdapter],
  exports: [ToriAdapter],
})
export class ToriModule {}
