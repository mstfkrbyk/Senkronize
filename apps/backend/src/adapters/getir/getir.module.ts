import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GetirAdapter } from './getir.adapter';

@Module({
  imports: [CommonModule],
  providers: [GetirAdapter],
  exports: [GetirAdapter],
})
export class GetirModule {}
