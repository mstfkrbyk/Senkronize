import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TedarikciAdapter } from './tedarikci.adapter';

@Module({
  imports: [CommonModule],
  providers: [TedarikciAdapter],
  exports: [TedarikciAdapter],
})
export class TedarikciModule {}
