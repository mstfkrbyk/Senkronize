import { Module } from '@nestjs/common';

import { KolaybiErpModule } from '../adapters/erp/kolaybi/kolaybi.module';
import { LogoTigerModule } from '../adapters/erp/logo/logo.module';
import { MikroErpModule } from '../adapters/erp/mikro/mikro.module';
import { NetsisErpModule } from '../adapters/erp/netsis/netsis.module';
import { ErpRestHttpModule } from '../adapters/erp/erp-rest-http.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationPolicyModule } from '../integration-policy/integration-policy.module';
import { QueueModule } from '../queue/queue.module';

import { ErpController } from './erp.controller';
import { ErpSyncSettingsService } from './erp-sync-settings.service';

@Module({
  imports: [
    PrismaModule,
    IntegrationPolicyModule,
    QueueModule,
    EncryptionModule,
    ErpRestHttpModule,
    LogoTigerModule,
    MikroErpModule,
    KolaybiErpModule,
    NetsisErpModule,
  ],
  controllers: [ErpController],
  providers: [ErpSyncSettingsService],
  exports: [
    ErpSyncSettingsService,
    ErpRestHttpModule,
    LogoTigerModule,
    MikroErpModule,
    KolaybiErpModule,
    NetsisErpModule,
  ],
})
export class ErpModule {}
