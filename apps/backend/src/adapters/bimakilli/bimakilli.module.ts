import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BimakilliAdapter } from './bimakilli.adapter';

@Module({
  imports: [CommonModule],
  providers: [BimakilliAdapter],
  exports: [BimakilliAdapter],
})
export class BimakilliModule {}
