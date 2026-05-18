import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { MediamarktAdapter } from './mediamarkt.adapter';

@Module({
  imports: [CommonModule],
  providers: [MediamarktAdapter],
  exports: [MediamarktAdapter],
})
export class MediamarktModule {}
