import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { VirginMegastoreAdapter } from './virgin-megastore.adapter';

@Module({
  imports: [CommonModule],
  providers: [VirginMegastoreAdapter],
  exports: [VirginMegastoreAdapter],
})
export class VirginMegastoreModule {}
