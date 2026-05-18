import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PorlandAdapter } from './porland.adapter';

@Module({
  imports: [CommonModule],
  providers: [PorlandAdapter],
  exports: [PorlandAdapter],
})
export class PorlandModule {}
