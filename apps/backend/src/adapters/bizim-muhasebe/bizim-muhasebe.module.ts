import { Module } from '@nestjs/common';

import { BizimMuhasebeAdapter } from './bizim-muhasebe.adapter';

@Module({
  providers: [BizimMuhasebeAdapter],
  exports: [BizimMuhasebeAdapter],
})
export class BizimMuhasebeModule {}
