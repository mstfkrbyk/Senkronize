import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { PgmallAdapter } from './pgmall.adapter';

@Module({
  imports: [CommonModule],
  providers: [PgmallAdapter],
  exports: [PgmallAdapter],
})
export class PgmallModule {}
