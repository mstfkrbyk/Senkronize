import { Module } from '@nestjs/common';

import { ErpRestHttpService } from '../erp-rest-http';

import { MikroErpAdapter } from './mikro.adapter';

@Module({
  providers: [ErpRestHttpService, MikroErpAdapter],
  exports: [MikroErpAdapter],
})
export class MikroErpModule {}
