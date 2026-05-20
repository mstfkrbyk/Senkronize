import { useEffect, useState, type ReactElement } from 'react';

export type SyncPhase = 'products' | 'stock' | 'orders' | 'prices';

export interface SyncProgressProps {
  phase: SyncPhase;
  current: number;
  total: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
}

const PHASE_ORDER: SyncPhase[] = ['products', 'stock', 'orders', 'prices'];

const PHASE_LABELS: Record<SyncPhase, string> = {
  products: 'Ürünler',
  stock: 'Stok',
  orders: 'Siparişler',
  prices: 'Fiyatlar',
};

function phaseIndex(phase: SyncPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function SyncProgress({
  phase,
  current,
  total,
  status,
  message,
}: SyncProgressProps): ReactElement {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (status !== 'completed') {
      setShowConfetti(false);
      return;
    }
    setShowConfetti(true);
    const id = window.setTimeout(() => setShowConfetti(false), 1000);
    return () => window.clearTimeout(id);
  }, [status]);

  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : status === 'completed' ? 100 : 0;
  const activeIdx = phaseIndex(phase);

  return (
    <div className={`syncProgress ${status === 'error' ? 'syncProgressError' : ''}`}>
      {showConfetti ? (
        <div className="syncConfetti" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="syncConfettiPiece" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      ) : null}

      <div className="syncPhaseSteps">
        {PHASE_ORDER.map((p, idx) => {
          let stepState: 'done' | 'active' | 'pending' | 'error' = 'pending';
          if (status === 'error' && idx === activeIdx) {
            stepState = 'error';
          } else if (idx < activeIdx || (status === 'completed' && idx <= activeIdx)) {
            stepState = 'done';
          } else if (idx === activeIdx && status === 'running') {
            stepState = 'active';
          } else if (idx === activeIdx && status === 'completed') {
            stepState = 'done';
          }
          return (
            <div key={p} className={`syncPhaseStep syncPhaseStep_${stepState}`}>
              <span className="syncPhaseDot" />
              <span className="syncPhaseLabel">{PHASE_LABELS[p]}</span>
            </div>
          );
        })}
      </div>

      <div className="syncProgressBarTrack" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`syncProgressBarFill ${status === 'running' ? 'syncProgressBarAnim' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="syncProgressMeta">
        {status === 'running' ? (
          <>
            {PHASE_LABELS[phase]} — {current}/{total || '…'}
          </>
        ) : null}
        {status === 'completed' ? <>Tamamlandı — {PHASE_LABELS[phase]}</> : null}
        {status === 'idle' ? 'Hazır' : null}
        {status === 'error' ? <>Hata — {PHASE_LABELS[phase]}</> : null}
      </p>

      {message ? (
        <p className={`syncProgressMessage ${status === 'error' ? 'syncProgressMessageError' : ''}`}>{message}</p>
      ) : null}
    </div>
  );
}
