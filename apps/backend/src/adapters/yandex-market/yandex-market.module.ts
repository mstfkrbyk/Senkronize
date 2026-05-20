import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { YandexMarketAdapter } from './yandex-market.adapter';

@Module({
  imports: [CommonModule],
  providers: [YandexMarketAdapter],
  exports: [YandexMarketAdapter],
})
export class YandexMarketModule {}
