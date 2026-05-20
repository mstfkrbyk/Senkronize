import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MytheresaAdapter } from './mytheresa.adapter';

@Module({
  imports: [CommonModule],
  providers: [MytheresaAdapter],
  exports: [MytheresaAdapter],
})
export class MytheresaModule {}
