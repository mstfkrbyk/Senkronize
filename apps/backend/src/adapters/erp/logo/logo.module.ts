import { Module } from '@nestjs/common';

import { ErpRestHttpService } from '../erp-rest-http';

import { LogoTigerErpAdapter } from './logo.adapter';

@Module({
  providers: [ErpRestHttpService, LogoTigerErpAdapter],
  exports: [LogoTigerErpAdapter],
})
export class LogoTigerModule {}
