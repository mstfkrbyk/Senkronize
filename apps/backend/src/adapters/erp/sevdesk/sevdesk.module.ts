import { Module } from '@nestjs/common';

import { SevdeskErpAdapter } from './sevdesk.adapter';

@Module({
  providers: [SevdeskErpAdapter],
  exports: [SevdeskErpAdapter],
})
export class SevdeskModule {}
