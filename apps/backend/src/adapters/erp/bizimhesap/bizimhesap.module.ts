import { Module } from '@nestjs/common';

import { BizimHesapErpAdapter } from './bizimhesap.adapter';

@Module({
  providers: [BizimHesapErpAdapter],
  exports: [BizimHesapErpAdapter],
})
export class BizimHesapErpModule {}
