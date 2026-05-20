import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { HarveyNormanAdapter } from './harvey-norman.adapter';

@Module({
  imports: [CommonModule],
  providers: [HarveyNormanAdapter],
  exports: [HarveyNormanAdapter],
})
export class HarveyNormanModule {}
