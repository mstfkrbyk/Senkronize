import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { GetirFoodAdapter } from './getir-food.adapter';

@Module({
  imports: [CommonModule],
  providers: [GetirFoodAdapter],
  exports: [GetirFoodAdapter],
})
export class GetirFoodModule {}
