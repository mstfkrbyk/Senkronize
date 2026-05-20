import { OrgProductLine } from '@prisma/client';

import {
  productSelectionToProductLines,
  resolveOrgProductLines,
} from './product-lines';

describe('resolveOrgProductLines', () => {
  it('null veya eksik değerde her iki hat (BUNDLE davranışı)', () => {
    expect(resolveOrgProductLines(null)).toEqual([
      OrgProductLine.INTEGRATION,
      OrgProductLine.ACCOUNTING,
    ]);
    expect(resolveOrgProductLines(undefined)).toEqual([
      OrgProductLine.INTEGRATION,
      OrgProductLine.ACCOUNTING,
    ]);
  });

  it('BUNDLE tek başına her iki hatta genişler', () => {
    expect(resolveOrgProductLines(['BUNDLE'])).toEqual([
      OrgProductLine.INTEGRATION,
      OrgProductLine.ACCOUNTING,
    ]);
  });

  it('yalnızca INTEGRATION döner', () => {
    expect(resolveOrgProductLines(['INTEGRATION'])).toEqual([
      OrgProductLine.INTEGRATION,
    ]);
  });
});

describe('productSelectionToProductLines', () => {
  it('seçim yoksa varsayılan her iki hat', () => {
    expect(productSelectionToProductLines()).toEqual([
      OrgProductLine.INTEGRATION,
      OrgProductLine.ACCOUNTING,
    ]);
  });

  it('ACCOUNTING seçimi yalnızca muhasebe hattı', () => {
    expect(productSelectionToProductLines('ACCOUNTING')).toEqual([
      OrgProductLine.ACCOUNTING,
    ]);
  });
});
