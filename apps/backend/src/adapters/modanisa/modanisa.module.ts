import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ModanisaAdapter } from './modanisa.adapter';

@Module({
  imports: [CommonModule],
  providers: [ModanisaAdapter],
  exports: [ModanisaAdapter],
})
export class ModanisaModule {}
