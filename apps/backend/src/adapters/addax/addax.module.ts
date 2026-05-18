import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AddaxAdapter } from './addax.adapter';

@Module({
  imports: [CommonModule],
  providers: [AddaxAdapter],
  exports: [AddaxAdapter],
})
export class AddaxModule {}
