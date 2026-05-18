import { Module } from '@nestjs/common';

import { AllegroAdapter } from './allegro.adapter';

@Module({
  providers: [AllegroAdapter],
  exports: [AllegroAdapter],
})
export class AllegroModule {}
