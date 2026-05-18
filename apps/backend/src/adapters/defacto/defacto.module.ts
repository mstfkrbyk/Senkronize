import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { DefactoAdapter } from './defacto.adapter';

@Module({
  imports: [CommonModule],
  providers: [DefactoAdapter],
  exports: [DefactoAdapter],
})
export class DefactoModule {}
