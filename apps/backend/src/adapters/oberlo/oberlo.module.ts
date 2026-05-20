import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { OberloAdapter } from './oberlo.adapter';

@Module({
  imports: [CommonModule],
  providers: [OberloAdapter],
  exports: [OberloAdapter],
})
export class OberloModule {}
