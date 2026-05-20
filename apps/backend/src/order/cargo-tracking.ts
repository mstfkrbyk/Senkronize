export function getTrackingUrl(provider: string, trackingNo: string): string {
  const map: Record<string, string> = {
    YURTICI: `https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code=${trackingNo}`,
    MNG: `https://www.mngkargo.com.tr/?barcode=${trackingNo}`,
    ARAS: `https://kargotakip.araskargo.com.tr/?trackingno=${trackingNo}`,
    PTT: `https://www.ptt.gov.tr/tr/anasayfa/takip?trackNo=${trackingNo}`,
    SURAT: `https://www.suratkargo.com.tr/kargo-takip?barcode=${trackingNo}`,
    UPS: `https://www.ups.com/track?tracknum=${trackingNo}`,
    DHL: `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${trackingNo}`,
    FEDEX: `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNo}`,
  };
  return map[provider] ?? '#';
}
