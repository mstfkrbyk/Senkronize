import { BadRequestException } from '@nestjs/common';
import { ErpType } from '@prisma/client';
import type { IErpAdapter } from '@senkronize/shared';

import { KolaybiErpAdapter } from '../adapters/erp/kolaybi/kolaybi.adapter';
import { ErpRestHttpService } from '../adapters/erp/erp-rest-http';
import { MikroErpAdapter } from '../adapters/erp/mikro/mikro.adapter';

/** ERP tipine göre adaptör örneği oluşturur (Nest DI dışı kullanım için) */
export function createErpAdapter(
  erpType: ErpType,
  http: ErpRestHttpService,
): IErpAdapter {
  switch (erpType) {
    case ErpType.MIKRO:
      return new MikroErpAdapter(http);
    case ErpType.KOLAYBI:
      return new KolaybiErpAdapter(http);
    default:
      throw new BadRequestException(`Desteklenmeyen ERP tipi: ${erpType}`);
  }
}
