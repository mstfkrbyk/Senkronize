import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { NeweggAdapter } from './newegg.adapter';

@Module({
  imports: [CommonModule],
  providers: [NeweggAdapter],
  exports: [NeweggAdapter],
})
export class NeweggModule {}
