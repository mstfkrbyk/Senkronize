import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { TazeDirektAdapter } from './taze-direkt.adapter';

@Module({
  imports: [CommonModule],
  providers: [TazeDirektAdapter],
  exports: [TazeDirektAdapter],
})
export class TazeDirektModule {}
