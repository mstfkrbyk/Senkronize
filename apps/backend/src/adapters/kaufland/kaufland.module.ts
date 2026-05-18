import { Module } from '@nestjs/common';

import { KauflandAdapter } from './kaufland.adapter';

@Module({
  providers: [KauflandAdapter],
  exports: [KauflandAdapter],
})
export class KauflandModule {}
