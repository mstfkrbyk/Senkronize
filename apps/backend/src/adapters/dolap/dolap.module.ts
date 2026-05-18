import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DolapAdapter } from './dolap.adapter';

@Module({
  imports: [CommonModule],
  providers: [DolapAdapter],
  exports: [DolapAdapter],
})
export class DolapModule {}
