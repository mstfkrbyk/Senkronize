import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { IdefixAdapter } from './idefix.adapter';

@Module({
  imports: [CommonModule],
  providers: [IdefixAdapter],
  exports: [IdefixAdapter],
})
export class IdefixModule {}
