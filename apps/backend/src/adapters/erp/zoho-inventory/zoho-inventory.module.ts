import { Module } from '@nestjs/common';

import { ZohoInventoryErpAdapter } from './zoho-inventory.adapter';

@Module({
  providers: [ZohoInventoryErpAdapter],
  exports: [ZohoInventoryErpAdapter],
})
export class ZohoInventoryModule {}
