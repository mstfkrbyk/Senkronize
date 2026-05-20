import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { RebelleAdapter } from './rebelle.adapter';

@Module({
  imports: [CommonModule],
  providers: [RebelleAdapter],
  exports: [RebelleAdapter],
})
export class RebelleModule {}
