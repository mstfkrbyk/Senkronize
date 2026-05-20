import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { Street11Adapter } from './street11.adapter';

@Module({
  imports: [CommonModule],
  providers: [Street11Adapter],
  exports: [Street11Adapter],
})
export class Street11Module {}
