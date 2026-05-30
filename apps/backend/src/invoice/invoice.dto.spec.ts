import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { InvoiceQueryDto } from './invoice.dto';

describe('InvoiceQueryDto', () => {
  it('orderIds virgülle ayrılmış stringi diziye çevirir', () => {
    const dto = plainToInstance(InvoiceQueryDto, {
      orderIds: `${'orderid1aaaaaaaaaaaa'}, ${'orderid2aaaaaaaaaaaa'}`,
    });
    expect(dto.orderIds).toEqual(['orderid1aaaaaaaaaaaa', 'orderid2aaaaaaaaaaaa']);
    expect(validateSync(dto)).toHaveLength(0);
  });
});
