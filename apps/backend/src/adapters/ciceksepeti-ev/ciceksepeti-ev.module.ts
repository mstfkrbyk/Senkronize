import { Module } from '@nestjs/common';

import { CiceksepetiEvAdapter } from './ciceksepeti-ev.adapter';

@Module({
  providers: [CiceksepetiEvAdapter],
  exports: [CiceksepetiEvAdapter],
})
export class CiceksepetiEvModule {}
