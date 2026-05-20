import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ThemarketNzAdapter } from './themarket-nz.adapter';

@Module({
  imports: [CommonModule],
  providers: [ThemarketNzAdapter],
  exports: [ThemarketNzAdapter],
})
export class ThemarketNzModule {}
