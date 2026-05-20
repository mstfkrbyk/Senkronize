import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SahibindenB2bAdapter } from './sahibinden-b2b.adapter';

@Module({
  imports: [CommonModule],
  providers: [SahibindenB2bAdapter],
  exports: [SahibindenB2bAdapter],
})
export class SahibindenB2bModule {}
