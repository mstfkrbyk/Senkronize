import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { ZalandoLoungeAdapter } from './zalando-lounge.adapter';

@Module({
  imports: [CommonModule],
  providers: [ZalandoLoungeAdapter],
  exports: [ZalandoLoungeAdapter],
})
export class ZalandoLoungeModule {}
