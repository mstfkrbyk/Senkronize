import { describe, expect, it } from 'vitest';

import {
  buildPaletteNavCommands,
  isCommonPaletteNavPath,
  resolveCommonPaletteNavGroup,
} from './command-palette-nav';

describe('command-palette-nav', () => {
  it('isCommonPaletteNavPath matches Ortak rotaları', () => {
    expect(isCommonPaletteNavPath('/notifications')).toBe(true);
    expect(isCommonPaletteNavPath('/support/ticket-1')).toBe(true);
    expect(isCommonPaletteNavPath('/settings/subscription')).toBe(true);
    expect(isCommonPaletteNavPath('/audit-logs')).toBe(true);
    expect(isCommonPaletteNavPath('/dashboard')).toBe(false);
  });

  it('resolveCommonPaletteNavGroup returns common for Ortak yaprakları', () => {
    expect(resolveCommonPaletteNavGroup('/settings')).toBe('common');
    expect(resolveCommonPaletteNavGroup('/support')).toBe('common');
    expect(resolveCommonPaletteNavGroup('/notifications')).toBe('common');
    expect(resolveCommonPaletteNavGroup('/orders')).toBeUndefined();
  });

  it('buildPaletteNavCommands assigns common group to Ayarlar, Destek, Bildirimler', () => {
    const navigate = (): void => {};
    const onClose = (): void => {};
    const t = (key: string): string => {
      const labels: Record<string, string> = {
        'nav.settings': 'Ayarlar',
        'nav.support': 'Destek',
        'nav.notifications': 'Bildirimler',
        'nav.auditLogs': 'Denetim kayıtları',
      };
      return labels[key] ?? key;
    };

    const cmds = buildPaletteNavCommands(
      {
        orgType: 'DIRECT',
        orgProducts: ['INTEGRATION', 'ACCOUNTING'],
        accountingMode: 'NATIVE',
      },
      t,
      navigate,
      onClose,
    );

    const byTitle = Object.fromEntries(cmds.map((cmd) => [cmd.title, cmd]));
    expect(byTitle.Ayarlar?.navGroup).toBe('common');
    expect(byTitle.Destek?.navGroup).toBe('common');
    expect(byTitle.Bildirimler?.navGroup).toBe('common');
  });
});
