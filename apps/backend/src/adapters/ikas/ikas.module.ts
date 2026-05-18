import { Module } from '@nestjs/common';

import { IkasAdapter } from './ikas.adapter';

@Module({
  providers: [IkasAdapter],
  exports: [IkasAdapter],
})
export class IkasModule {}
