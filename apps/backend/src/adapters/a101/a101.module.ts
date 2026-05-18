import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { A101Adapter } from './a101.adapter';

@Module({
  imports: [CommonModule],
  providers: [A101Adapter],
  exports: [A101Adapter],
})
export class A101Module {}
