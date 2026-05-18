import { Module } from '@nestjs/common';

import { OttoAdapter } from './otto.adapter';

@Module({
  providers: [OttoAdapter],
  exports: [OttoAdapter],
})
export class OttoModule {}
