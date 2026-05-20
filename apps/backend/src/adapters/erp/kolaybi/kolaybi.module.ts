import { Module } from '@nestjs/common';

import { ErpRestHttpModule } from '../erp-rest-http.module';

import { KolaybiErpAdapter } from './kolaybi.adapter';

@Module({
  imports: [ErpRestHttpModule],
  providers: [KolaybiErpAdapter],
  exports: [KolaybiErpAdapter],
})
export class KolaybiErpModule {}
