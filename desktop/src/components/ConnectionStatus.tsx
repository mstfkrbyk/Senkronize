import type { ReactElement } from 'react';

import type { HealthStatus } from '@/lib/tauri';

interface ConnectionStatusProps {
  health: HealthStatus | null;
}

export function ConnectionStatus({ health }: ConnectionStatusProps): ReactElement {
  const cloudOk = health?.cloudConnected === true;
  const localOk = health?.localErpConnected === true;

  return (
    <div className="panel">
      <p className="h2">Bağlantı Özeti</p>
      <div className="stack" style={{ marginTop: 12 }}>
        <div className="row">
          <span className={`dot ${cloudOk ? 'dotOk' : 'dotBad'}`} />
          <span style={{ fontSize: 13, color: '#334155' }}>
            Bulut API: {cloudOk ? 'Ulaşılabilir' : 'Ulaşılamıyor'}
          </span>
        </div>
        <div className="row">
          <span className={`dot ${localOk ? 'dotOk' : 'dotNeutral'}`} />
          <span style={{ fontSize: 13, color: '#334155' }}>
            Yerel ERP: {localOk ? 'Ulaşılabilir' : 'Test edilmedi / kapalı'}
          </span>
        </div>
      </div>
    </div>
  );
}
