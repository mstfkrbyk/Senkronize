import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { OpensooqAdapter } from './opensooq.adapter';

@Module({
  imports: [CommonModule],
  providers: [OpensooqAdapter],
  exports: [OpensooqAdapter],
})
export class OpensooqModule {}
