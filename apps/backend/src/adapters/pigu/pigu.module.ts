import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PiguAdapter } from './pigu.adapter';

@Module({
  imports: [CommonModule],
  providers: [PiguAdapter],
  exports: [PiguAdapter],
})
export class PiguModule {}
