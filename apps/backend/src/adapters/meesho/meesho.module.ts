import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MeeshoAdapter } from './meesho.adapter';

@Module({
  imports: [CommonModule],
  providers: [MeeshoAdapter],
  exports: [MeeshoAdapter],
})
export class MeeshoModule {}
