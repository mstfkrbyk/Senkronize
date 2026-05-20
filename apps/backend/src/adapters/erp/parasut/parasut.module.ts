import { Module } from '@nestjs/common';

import { CacheModule } from '../../../common/cache/cache.module';

import { ParasutErpAdapter } from './parasut.adapter';
import { ParasutOAuthService } from './parasut.oauth';

@Module({
  imports: [CacheModule],
  providers: [ParasutOAuthService, ParasutErpAdapter],
  exports: [ParasutErpAdapter],
})
export class ParasutErpModule {}
