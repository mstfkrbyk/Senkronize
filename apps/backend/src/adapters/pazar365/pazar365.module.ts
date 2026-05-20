import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { Pazar365Adapter } from './pazar365.adapter';

@Module({
  imports: [CommonModule],
  providers: [Pazar365Adapter],
  exports: [Pazar365Adapter],
})
export class Pazar365Module {}
