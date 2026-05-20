import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JiomartAdapter } from './jiomart.adapter';

@Module({
  imports: [CommonModule],
  providers: [JiomartAdapter],
  exports: [JiomartAdapter],
})
export class JiomartModule {}
