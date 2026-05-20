import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AwokAdapter } from './awok.adapter';

@Module({
  imports: [CommonModule],
  providers: [AwokAdapter],
  exports: [AwokAdapter],
})
export class AwokModule {}
