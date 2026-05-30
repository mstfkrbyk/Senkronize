import { Module } from '@nestjs/common';

import { ConnectionHealthModule } from '../connection-health/connection-health.module';
import { ErpModule } from '../erp/erp.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { ErpConnectionController } from './erp-connection.controller';
import { ErpConnectionService } from './erp-connection.service';
import { ErpProductReconcileService } from './erp-product-reconcile.service';

@Module({
  imports: [ErpModule, ConnectionHealthModule, WarehouseModule],
  controllers: [ErpConnectionController],
  providers: [ErpConnectionService, ErpProductReconcileService],
  exports: [ErpConnectionService, ErpProductReconcileService],
})
export class ErpConnectionModule {}
