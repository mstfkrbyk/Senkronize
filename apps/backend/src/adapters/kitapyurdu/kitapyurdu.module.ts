import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { KitapyurduAdapter } from './kitapyurdu.adapter';

@Module({
  imports: [CommonModule],
  providers: [KitapyurduAdapter],
  exports: [KitapyurduAdapter],
})
export class KitapyurduModule {}
