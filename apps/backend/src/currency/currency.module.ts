import { Module } from '@nestjs/common';

import { CurrencyCoreModule } from './currency-core.module';
import { CurrencyController } from './currency.controller';
import { CurrencyTask } from './currency.task';

@Module({
  imports: [CurrencyCoreModule],
  controllers: [CurrencyController],
  providers: [CurrencyTask],
  exports: [CurrencyCoreModule],
})
export class CurrencyModule {}
