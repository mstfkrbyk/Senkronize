import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CasasBahiaAdapter } from './casas-bahia.adapter';

@Module({
  imports: [CommonModule],
  providers: [CasasBahiaAdapter],
  exports: [CasasBahiaAdapter],
})
export class CasasBahiaModule {}
