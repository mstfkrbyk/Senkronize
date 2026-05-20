import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ERP_HTTP_TIMEOUT_MS, ErpRestHttpService } from './erp-rest-http';

@Module({
  imports: [
    HttpModule.register({
      timeout: ERP_HTTP_TIMEOUT_MS,
    }),
  ],
  providers: [ErpRestHttpService],
  exports: [ErpRestHttpService],
})
export class ErpRestHttpModule {}
