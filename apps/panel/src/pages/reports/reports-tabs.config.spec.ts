import { describe, expect, it } from 'vitest';

import {
  resolveAnalyticsReportPresentation,
  resolveAnalyticsTabVisible,
  resolveCustomReportPresentation,
  resolveProfitReportPresentation,
  resolveReportsProductAccess,
  resolveReportsTabs,
  resolveSalesReportPresentation,
  resolveScheduleReportPresentation,
  resolveScheduleTabVisible,
  resolveTaxReportPresentation,
} from './reports-tabs.config';

describe('resolveSalesReportPresentation', () => {
  it('NATIVE + muhasebe-only: tam satış raporu', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveSalesReportPresentation(access, 'NATIVE')).toBe('full');
  });

  it('EXTERNAL_ERP + muhasebe-only: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveSalesReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });

  it('EXTERNAL_ERP + yalnız entegrasyon: tam pazaryeri satışı', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveSalesReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });

  it('BUNDLE + EXTERNAL_ERP: tam pazaryeri satışı', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveSalesReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });
});

describe('resolveProfitReportPresentation', () => {
  it('NATIVE + muhasebe: tam kâr raporu', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveProfitReportPresentation(access, 'NATIVE')).toBe('full');
  });

  it('EXTERNAL_ERP + muhasebe: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveProfitReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });

  it('EXTERNAL_ERP + yalnız entegrasyon: pazaryeri kârı (tam)', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveProfitReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });

  it('BUNDLE + EXTERNAL_ERP: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveProfitReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });
});

describe('resolveTaxReportPresentation', () => {
  it('NATIVE + muhasebe: tam KDV özeti', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveTaxReportPresentation(access, 'NATIVE')).toBe('full');
  });

  it('EXTERNAL_ERP + muhasebe: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveTaxReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });

  it('EXTERNAL_ERP + yalnız entegrasyon: KDV sekmesi yok (tam varsayılan)', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveTaxReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });

  it('BUNDLE + EXTERNAL_ERP: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveTaxReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });
});

describe('resolveCustomReportPresentation', () => {
  it('NATIVE + muhasebe: tam özel rapor builder', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveCustomReportPresentation(access, 'NATIVE')).toBe('full');
  });

  it('EXTERNAL_ERP + muhasebe: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveCustomReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });

  it('EXTERNAL_ERP + yalnız entegrasyon: tam (özel sekme yok)', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveCustomReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });

  it('BUNDLE + EXTERNAL_ERP: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveCustomReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });
});

describe('resolveReportsTabs custom visibility', () => {
  it('muhasebe-only NATIVE: özel rapor sekmesi var', () => {
    const tabs = resolveReportsTabs(['ACCOUNTING'], 'NATIVE');
    expect(tabs.map((t) => t.id)).toContain('custom');
  });

  it('muhasebe-only EXTERNAL_ERP: özel rapor sekmesi yok', () => {
    const tabs = resolveReportsTabs(['ACCOUNTING'], 'EXTERNAL_ERP');
    expect(tabs.map((t) => t.id)).not.toContain('custom');
  });
});

describe('resolveAnalyticsTabVisible', () => {
  it('muhasebe-only: platform analitiği sekmesi yok', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveAnalyticsTabVisible(access)).toBe(false);
  });

  it('yalnız entegrasyon: platform analitiği sekmesi var', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveAnalyticsTabVisible(access)).toBe(true);
  });

  it('BUNDLE: platform analitiği sekmesi var', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveAnalyticsTabVisible(access)).toBe(true);
  });
});

describe('resolveAnalyticsReportPresentation', () => {
  it('NATIVE + muhasebe: tam platform analitiği', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveAnalyticsReportPresentation(access, 'NATIVE')).toBe('full');
  });

  it('EXTERNAL_ERP + muhasebe: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveAnalyticsReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });

  it('EXTERNAL_ERP + yalnız entegrasyon: tam platform analitiği', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveAnalyticsReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });

  it('BUNDLE + EXTERNAL_ERP: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveAnalyticsReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });
});

describe('resolveReportsTabs analytics visibility', () => {
  it('muhasebe-only NATIVE: analytics sekmesi yok', () => {
    const tabs = resolveReportsTabs(['ACCOUNTING'], 'NATIVE');
    expect(tabs.map((t) => t.id)).not.toContain('analytics');
  });

  it('muhasebe-only EXTERNAL_ERP: analytics sekmesi yok', () => {
    const tabs = resolveReportsTabs(['ACCOUNTING'], 'EXTERNAL_ERP');
    expect(tabs.map((t) => t.id)).not.toContain('analytics');
  });

  it('yalnız entegrasyon: analytics sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION'], 'NATIVE');
    expect(tabs.map((t) => t.id)).toContain('analytics');
  });

  it('BUNDLE NATIVE: analytics sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION', 'ACCOUNTING'], 'NATIVE');
    expect(tabs.map((t) => t.id)).toContain('analytics');
  });

  it('BUNDLE EXTERNAL_ERP: analytics sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION', 'ACCOUNTING'], 'EXTERNAL_ERP');
    expect(tabs.map((t) => t.id)).toContain('analytics');
  });
});

describe('resolveScheduleTabVisible', () => {
  it('muhasebe-only: zamanlama sekmesi yok', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveScheduleTabVisible(access)).toBe(false);
  });

  it('yalnız entegrasyon: zamanlama sekmesi var', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveScheduleTabVisible(access)).toBe(true);
  });

  it('BUNDLE: zamanlama sekmesi var', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveScheduleTabVisible(access)).toBe(true);
  });
});

describe('resolveScheduleReportPresentation', () => {
  it('NATIVE + muhasebe-only: sekme yok (tam varsayılan)', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveScheduleReportPresentation(access, 'NATIVE')).toBe('full');
  });

  it('EXTERNAL_ERP + muhasebe-only: sekme yok', () => {
    const access = resolveReportsProductAccess(['ACCOUNTING']);
    expect(resolveScheduleReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });

  it('EXTERNAL_ERP + yalnız entegrasyon: tam zamanlama', () => {
    const access = resolveReportsProductAccess(['INTEGRATION']);
    expect(resolveScheduleReportPresentation(access, 'EXTERNAL_ERP')).toBe('full');
  });

  it('BUNDLE + EXTERNAL_ERP: harici ERP bilgilendirmesi', () => {
    const access = resolveReportsProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveScheduleReportPresentation(access, 'EXTERNAL_ERP')).toBe(
      'externalErpNotice',
    );
  });
});

describe('resolveReportsTabs schedule visibility', () => {
  it('muhasebe-only NATIVE: zamanlama sekmesi yok', () => {
    const tabs = resolveReportsTabs(['ACCOUNTING'], 'NATIVE');
    expect(tabs.map((t) => t.id)).not.toContain('schedule');
  });

  it('yalnız entegrasyon: zamanlama sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION'], 'NATIVE');
    expect(tabs.map((t) => t.id)).toContain('schedule');
  });

  it('BUNDLE NATIVE: zamanlama sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION', 'ACCOUNTING'], 'NATIVE');
    expect(tabs.map((t) => t.id)).toContain('schedule');
  });

  it('BUNDLE EXTERNAL_ERP: zamanlama sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION', 'ACCOUNTING'], 'EXTERNAL_ERP');
    expect(tabs.map((t) => t.id)).toContain('schedule');
  });
});

describe('resolveReportsTabs profit visibility', () => {
  it('muhasebe-only EXTERNAL_ERP: kâr sekmesi yok', () => {
    const tabs = resolveReportsTabs(['ACCOUNTING'], 'EXTERNAL_ERP');
    expect(tabs.map((t) => t.id)).toEqual(['erp-transfer']);
  });

  it('BUNDLE EXTERNAL_ERP: kâr sekmesi var', () => {
    const tabs = resolveReportsTabs(['INTEGRATION', 'ACCOUNTING'], 'EXTERNAL_ERP');
    expect(tabs.map((t) => t.id)).toContain('profit');
  });
});
