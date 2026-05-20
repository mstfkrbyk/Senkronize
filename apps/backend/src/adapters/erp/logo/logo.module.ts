import { Module } from '@nestjs/common';

import { ErpRestHttpModule } from '../erp-rest-http.module';

import { LogoTigerErpAdapter } from './logo.adapter';

@Module({
  imports: [ErpRestHttpModule],
  providers: [LogoTigerErpAdapter],
  exports: [LogoTigerErpAdapter],
})
export class LogoTigerModule {}
