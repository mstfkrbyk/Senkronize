import { Module } from '@nestjs/common';

import { FinansMuhasebeAdapter } from './finans-muhasebe.adapter';

@Module({
  providers: [FinansMuhasebeAdapter],
  exports: [FinansMuhasebeAdapter],
})
export class FinansMuhasebeModule {}
