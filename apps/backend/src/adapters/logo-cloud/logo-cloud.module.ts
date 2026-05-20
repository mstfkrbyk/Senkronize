import { Module } from '@nestjs/common';

import { LogoCloudAdapter } from './logo-cloud.adapter';

@Module({
  providers: [LogoCloudAdapter],
  exports: [LogoCloudAdapter],
})
export class LogoCloudModule {}
