import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { JumiaTnAdapter } from './jumia-tn.adapter';

@Module({
  imports: [CommonModule],
  providers: [JumiaTnAdapter],
  exports: [JumiaTnAdapter],
})
export class JumiaTnModule {}
