import { Module } from '@nestjs/common';

import { IyzicoAdapter } from './iyzico.adapter';

@Module({
  providers: [IyzicoAdapter],
  exports: [IyzicoAdapter],
})
export class IyzicoModule {}
