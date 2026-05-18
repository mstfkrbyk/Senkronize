import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileDown, Loader2, Printer } from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { buildInvoicePrintDocument } from '@/lib/invoice-print-html';
import type { Order } from '@/types/order';

interface Props {
  order: Order;
  organizationName: string;
  organizationTaxNumber?: string | null;
}

function formatTry(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function InvoicePreview({
  order,
  organizationName,
  organizationTaxNumber,
}: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null);

  const handleClientPdf = useCallback(async (): Promise<void> => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    setBusy('pdf');
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`fatura-${order.platformOrderId}.pdf`);
    } finally {
      setBusy(null);
    }
  }, [order.platformOrderId]);

  const handlePrint = useCallback((): void => {
    setBusy('print');
    try {
      const html = buildInvoicePrintDocument(order, organizationName, organizationTaxNumber);
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      if (!doc) {
        document.body.removeChild(iframe);
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = (): void => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };
    } finally {
      setBusy(null);
    }
  }, [order, organizationName, organizationTaxNumber]);

  const invoiceNo = `FTR-${order.id.slice(-10).toUpperCase()}`;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Fatura önizleme</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={busy !== null}
            onClick={() => {
              void handleClientPdf();
            }}
          >
            {busy === 'pdf' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-3.5 w-3.5" aria-hidden />
            )}
            PDF (istemci)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={busy !== null}
            onClick={handlePrint}
          >
            {busy === 'print' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Printer className="h-3.5 w-3.5" aria-hidden />
            )}
            Yazdır
          </Button>
        </div>
      </div>

      <div
        ref={rootRef}
        className="invoice-print-root rounded-md border border-dashed bg-white p-4 text-sm text-slate-900 shadow-inner"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
          <div>
            <p className="text-lg font-semibold text-sky-500">Senkronize</p>
            <p className="text-base font-medium text-slate-800">Satış faturası</p>
            <p className="mt-2 text-xs text-slate-600">{organizationName}</p>
            {organizationTaxNumber ? (
              <p className="text-xs text-slate-600">VKN/TCKN: {organizationTaxNumber}</p>
            ) : null}
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>
              <span className="font-medium text-slate-800">Fatura no:</span> {invoiceNo}
            </p>
            <p>
              <span className="font-medium text-slate-800">Tarih:</span>{' '}
              {formatDate(order.platformCreatedAt)}
            </p>
            <p>
              <span className="font-medium text-slate-800">Platform:</span> {order.platform}
            </p>
            <p>
              <span className="font-medium text-slate-800">Sipariş:</span>{' '}
              {order.platformOrderId}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-700">
          <span className="font-medium">Alıcı:</span> {order.customerName}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-200 p-2">Ürün</th>
                <th className="border border-slate-200 p-2">Barkod</th>
                <th className="border border-slate-200 p-2">SKU</th>
                <th className="border border-slate-200 p-2 text-right">Adet</th>
                <th className="border border-slate-200 p-2 text-right">Birim</th>
                <th className="border border-slate-200 p-2 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 p-2 text-slate-500" colSpan={6}>
                    Satır yok
                  </td>
                </tr>
              ) : (
                order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="border border-slate-200 p-2">
                      {it.productName?.trim() || it.sku}
                    </td>
                    <td className="border border-slate-200 p-2 font-mono">{it.barcode}</td>
                    <td className="border border-slate-200 p-2 font-mono">{it.sku}</td>
                    <td className="border border-slate-200 p-2 text-right tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="border border-slate-200 p-2 text-right tabular-nums">
                      {formatTry(it.unitPrice, order.currency)}
                    </td>
                    <td className="border border-slate-200 p-2 text-right tabular-nums">
                      {formatTry(String(Number(it.unitPrice) * it.quantity), order.currency)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-50 font-semibold">
                <td className="border border-slate-200 p-2 text-right" colSpan={5}>
                  Genel toplam
                </td>
                <td className="border border-slate-200 p-2 text-right tabular-nums">
                  {formatTry(order.totalAmount, order.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[10px] text-slate-400">
          Bu önizleme bilgilendirme amaçlıdır. Resmi belge için sunucu PDF veya ERP çıktısı
          kullanın.
        </p>
      </div>
    </div>
  );
}
