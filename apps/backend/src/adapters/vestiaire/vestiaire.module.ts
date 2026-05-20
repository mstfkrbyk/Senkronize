import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VestiaireAdapter } from './vestiaire.adapter';

@Module({
  imports: [CommonModule],
  providers: [VestiaireAdapter],
  exports: [VestiaireAdapter],
})
export class VestiaireModule {}
