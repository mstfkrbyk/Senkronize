import { Module } from '@nestjs/common';

import { ErpRestHttpModule } from '../erp-rest-http.module';

import { MikroErpAdapter } from './mikro.adapter';

@Module({
  imports: [ErpRestHttpModule],
  providers: [MikroErpAdapter],
  exports: [MikroErpAdapter],
})
export class MikroErpModule {}
