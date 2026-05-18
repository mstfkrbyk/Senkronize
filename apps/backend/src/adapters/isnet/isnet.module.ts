import { Module } from '@nestjs/common';

import { IsnetAdapter } from './isnet.adapter';

@Module({
  providers: [IsnetAdapter],
  exports: [IsnetAdapter],
})
export class IsnetModule {}
