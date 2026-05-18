import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { EnparaAdapter } from './enpara.adapter';

@Module({
  imports: [CommonModule],
  providers: [EnparaAdapter],
  exports: [EnparaAdapter],
})
export class EnparaModule {}
