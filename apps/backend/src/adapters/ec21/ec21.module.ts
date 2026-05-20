import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { Ec21Adapter } from './ec21.adapter';

@Module({
  imports: [CommonModule],
  providers: [Ec21Adapter],
  exports: [Ec21Adapter],
})
export class Ec21Module {}
