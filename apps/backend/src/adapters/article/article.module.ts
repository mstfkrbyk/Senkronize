import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { ArticleAdapter } from './article.adapter';

@Module({
  imports: [EncryptionModule],
  providers: [ArticleAdapter],
  exports: [ArticleAdapter],
})
export class ArticleModule {}
