import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ManomanoAdapter } from './manomano.adapter';

@Module({
  imports: [CommonModule],
  providers: [ManomanoAdapter],
  exports: [ManomanoAdapter],
})
export class ManomanoModule {}
