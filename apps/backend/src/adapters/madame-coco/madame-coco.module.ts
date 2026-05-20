import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { MadameCocoAdapter } from './madame-coco.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [MadameCocoAdapter],
  exports: [MadameCocoAdapter],
})
export class MadameCocoModule {}
