import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AkulakuAdapter } from './akulaku.adapter';

@Module({
  imports: [CommonModule],
  providers: [AkulakuAdapter],
  exports: [AkulakuAdapter],
})
export class AkulakuModule {}
