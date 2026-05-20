import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { UzumAdapter } from './uzum.adapter';

@Module({
  imports: [CommonModule],
  providers: [UzumAdapter],
  exports: [UzumAdapter],
})
export class UzumModule {}
