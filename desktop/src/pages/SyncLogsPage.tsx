import { Download, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { ERP_LABELS, type ErpKind } from '@/lib/erp-bridge-store';
import {
  clearSyncLogs,
  exportSyncLogsCsv,
  listSyncLogs,
  type SyncLog,
  type SyncLogStatus,
  type SyncLogType,
} from '@/lib/sync-log-store';

type TypeFilter = 'ALL' | SyncLogType;
type StatusFilter = 'ALL' | SyncLogStatus;

const TYPE_LABELS: Record<SyncLogType, string> = {
  STOCK: 'Stok',
  ORDER: 'Sipariş',
  PRODUCT: 'Ürün',
  PRICE: 'Fiyat',
};

const STATUS_LABELS: Record<SyncLogStatus, string> = {
  SUCCESS: 'Başarılı',
  FAILED: 'Hatalı',
  PARTIAL: 'Kısmi',
  RUNNING: 'Devam ediyor',
};

function erpLabel(erpType: string | undefined): string {
  if (!erpType) {
    return '—';
  }
  if (erpType in ERP_LABELS) {
    return ERP_LABELS[erpType as ErpKind];
  }
  return erpType;
}

function statusBadgeClass(status: SyncLogStatus): string {
  if (status === 'SUCCESS') {
    return 'logBadge logBadgeSuccess';
  }
  if (status === 'FAILED') {
    return 'logBadge logBadgeError';
  }
  if (status === 'RUNNING') {
    return 'logBadge logBadgeRunning';
  }
  return 'logBadge logBadgeWarn';
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('tr-TR');
}

export function SyncLogsPage(): ReactElement {
  const [logs, setLogs] = useState<SyncLog[]>(() => listSyncLogs());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailModal, setDetailModal] = useState<SyncLog | null>(null);

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return logs.filter((log) => {
      if (typeFilter !== 'ALL' && log.type !== typeFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && log.status !== statusFilter) {
        return false;
      }
      const ts = new Date(log.timestamp).getTime();
      if (fromMs !== null && !Number.isNaN(fromMs) && ts < fromMs) {
        return false;
      }
      if (toMs !== null && !Number.isNaN(toMs) && ts > toMs) {
        return false;
      }
      return true;
    });
  }, [logs, typeFilter, statusFilter, dateFrom, dateTo]);

  function onClear(): void {
    clearSyncLogs();
    setLogs([]);
  }

  function onExport(): void {
    const csv = exportSyncLogsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senkronize-sync-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onRowClick(log: SyncLog): void {
    setDetailModal(log);
  }

  return (
    <div className="stackLg">
      <div className="flexBetween">
        <div>
          <h1 className="h2">Sync Log Geçmişi</h1>
          <p className="muted">Son 500 senkron işlemi (yerel depolama). {filtered.length} kayıt.</p>
        </div>
        <div className="row">
          <button type="button" className="btn btnGhost" onClick={() => onExport()} disabled={filtered.length === 0}>
            <Download size={14} aria-hidden style={{ marginRight: 6 }} />
            CSV Dışa Aktar
          </button>
          <button type="button" className="btn btnGhost" onClick={() => onClear()}>
            <Trash2 size={14} aria-hidden style={{ marginRight: 6 }} />
            Log Temizle
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label className="muted" style={{ fontSize: 13 }}>
            İşlem tipi
            <select
              className="select"
              style={{ marginTop: 6, minWidth: 120 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="ALL">Tümü</option>
              <option value="PRODUCT">Ürün</option>
              <option value="STOCK">Stok</option>
              <option value="ORDER">Sipariş</option>
              <option value="PRICE">Fiyat</option>
            </select>
          </label>
          <label className="muted" style={{ fontSize: 13 }}>
            Durum
            <select
              className="select"
              style={{ marginTop: 6, minWidth: 140 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">Tümü</option>
              <option value="SUCCESS">Başarılı</option>
              <option value="FAILED">Hatalı</option>
              <option value="RUNNING">Devam ediyor</option>
              <option value="PARTIAL">Kısmi</option>
            </select>
          </label>
          <label className="muted" style={{ fontSize: 13 }}>
            Başlangıç
            <input
              type="date"
              className="input"
              style={{ marginTop: 6 }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="muted" style={{ fontSize: 13 }}>
            Bitiş
            <input
              type="date"
              className="input"
              style={{ marginTop: 6 }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th>Tarih / Saat</th>
              <th>ERP</th>
              <th>İşlem</th>
              <th>Sonuç</th>
              <th>Kayıt</th>
              <th>Süre</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id} className="dataTableRowClickable" onClick={() => onRowClick(log)}>
                <td className="logTimeMono">{formatTs(log.timestamp)}</td>
                <td>{erpLabel(log.erpType)}</td>
                <td>{TYPE_LABELS[log.type]}</td>
                <td>
                  <span className={statusBadgeClass(log.status)}>{STATUS_LABELS[log.status]}</span>
                </td>
                <td>{log.itemCount}</td>
                <td>{log.duration} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="muted" style={{ padding: 16, margin: 0 }}>
            Kayıt yok.
          </p>
        ) : null}
      </div>

      {detailModal ? (
        <div className="modalBackdrop" role="presentation" onClick={() => setDetailModal(null)}>
          <div
            className="modalCard"
            role="dialog"
            aria-labelledby="sync-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sync-detail-title" className="h2">
              Log detayı
            </h2>
            <p className="muted" style={{ marginTop: 8 }}>
              {formatTs(detailModal.timestamp)} · {erpLabel(detailModal.erpType)} ·{' '}
              {TYPE_LABELS[detailModal.type]} · {STATUS_LABELS[detailModal.status]}
            </p>
            <ul className="muted" style={{ marginTop: 12, paddingLeft: 18, fontSize: 13 }}>
              <li>İşlenen kayıt: {detailModal.itemCount}</li>
              <li>Süre: {detailModal.duration} ms</li>
            </ul>
            {detailModal.error ? (
              <>
                <p className="fieldLabel" style={{ marginTop: 14 }}>
                  Hata mesajı
                </p>
                <pre className="modalPre">{detailModal.error}</pre>
              </>
            ) : null}
            {detailModal.affectedRecords && detailModal.affectedRecords.length > 0 ? (
              <>
                <p className="fieldLabel" style={{ marginTop: 14 }}>
                  Etkilenen kayıtlar
                </p>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                  {detailModal.affectedRecords.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {!detailModal.error && !detailModal.affectedRecords?.length ? (
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                Ek detay kaydedilmemiş.
              </p>
            ) : null}
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btnGhost" onClick={() => setDetailModal(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
