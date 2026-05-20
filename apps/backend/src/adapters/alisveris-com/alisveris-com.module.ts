import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { AlisverisComAdapter } from './alisveris-com.adapter';

@Module({
  imports: [CommonModule],
  providers: [AlisverisComAdapter],
  exports: [AlisverisComAdapter],
})
export class AlisverisComModule {}
