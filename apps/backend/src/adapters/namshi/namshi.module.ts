import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { NamshiAdapter } from './namshi.adapter';

@Module({
  imports: [CommonModule],
  providers: [NamshiAdapter],
  exports: [NamshiAdapter],
})
export class NamshiModule {}
