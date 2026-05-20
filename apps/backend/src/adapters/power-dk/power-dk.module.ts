import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PowerDkAdapter } from './power-dk.adapter';

@Module({
  imports: [CommonModule],
  providers: [PowerDkAdapter],
  exports: [PowerDkAdapter],
})
export class PowerDkModule {}
