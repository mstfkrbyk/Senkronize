import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ArcelikAdapter } from './arcelik.adapter';

@Module({
  imports: [CommonModule],
  providers: [ArcelikAdapter],
  exports: [ArcelikAdapter],
})
export class ArcelikModule {}
