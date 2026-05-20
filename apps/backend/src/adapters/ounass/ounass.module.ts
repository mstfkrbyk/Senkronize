import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { OunassAdapter } from './ounass.adapter';

@Module({
  imports: [CommonModule],
  providers: [OunassAdapter],
  exports: [OunassAdapter],
})
export class OunassModule {}
