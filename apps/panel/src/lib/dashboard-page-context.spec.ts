import { describe, expect, it } from 'vitest';

import {
  resolveDashboardProductAccess,
  resolveDashboardSubtitleKey,
} from './dashboard-page-context';

describe('resolveDashboardSubtitleKey', () => {
  it('integration-only uses integration subtitle', () => {
    const access = resolveDashboardProductAccess(['INTEGRATION']);
    expect(resolveDashboardSubtitleKey(access, 'NATIVE')).toBe(
      'dashboard.subtitle.integration',
    );
  });

  it('bundle NATIVE uses hybrid native subtitle', () => {
    const access = resolveDashboardProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveDashboardSubtitleKey(access, 'NATIVE')).toBe(
      'dashboard.subtitle.hybridNative',
    );
  });

  it('bundle EXTERNAL_ERP uses hybrid external subtitle', () => {
    const access = resolveDashboardProductAccess(['INTEGRATION', 'ACCOUNTING']);
    expect(resolveDashboardSubtitleKey(access, 'EXTERNAL_ERP')).toBe(
      'dashboard.subtitle.hybridExternalErp',
    );
  });
});
