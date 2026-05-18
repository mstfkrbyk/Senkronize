import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { SahibindenProAdapter } from './sahibinden-pro.adapter';

@Module({
  imports: [CommonModule],
  providers: [SahibindenProAdapter],
  exports: [SahibindenProAdapter],
})
export class SahibindenProModule {}
