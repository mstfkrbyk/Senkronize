import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MigrosSanalAdapter } from './migros-sanal.adapter';

@Module({
  imports: [CommonModule],
  providers: [MigrosSanalAdapter],
  exports: [MigrosSanalAdapter],
})
export class MigrosSanalModule {}
