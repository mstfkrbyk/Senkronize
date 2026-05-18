import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { Qoo10Adapter } from './qoo10.adapter';

@Module({
  imports: [CommonModule],
  providers: [Qoo10Adapter],
  exports: [Qoo10Adapter],
})
export class Qoo10Module {}
