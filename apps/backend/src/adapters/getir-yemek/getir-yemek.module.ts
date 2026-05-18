import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GetirYemekAdapter } from './getir-yemek.adapter';

@Module({
  imports: [CommonModule],
  providers: [GetirYemekAdapter],
  exports: [GetirYemekAdapter],
})
export class GetirYemekModule {}
