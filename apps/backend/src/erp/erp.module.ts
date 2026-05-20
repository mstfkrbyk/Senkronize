import { Module } from '@nestjs/common';

import { ErpController } from './erp.controller';

@Module({
  controllers: [ErpController],
})
export class ErpModule {}
