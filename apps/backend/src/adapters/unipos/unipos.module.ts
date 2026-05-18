import { Module } from '@nestjs/common';

import { UniposAdapter } from './unipos.adapter';

@Module({
  providers: [UniposAdapter],
  exports: [UniposAdapter],
})
export class UniposModule {}
