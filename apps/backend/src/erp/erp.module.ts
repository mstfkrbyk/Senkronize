import { Module } from '@nestjs/common';

import { LogoTigerModule } from '../adapters/erp/logo/logo.module';
import { NetsisErpModule } from '../adapters/erp/netsis/netsis.module';
import { ErpRestHttpModule } from '../adapters/erp/erp-rest-http.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

import { ErpController } from './erp.controller';
import { ErpSyncSettingsService } from './erp-sync-settings.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    EncryptionModule,
    ErpRestHttpModule,
    LogoTigerModule,
    NetsisErpModule,
  ],
  controllers: [ErpController],
  providers: [ErpSyncSettingsService],
  exports: [
    ErpSyncSettingsService,
    ErpRestHttpModule,
    LogoTigerModule,
    NetsisErpModule,
  ],
})
export class ErpModule {}
