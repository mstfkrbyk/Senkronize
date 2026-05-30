import { XMLParser } from 'fast-xml-parser';
import axios, { type AxiosError } from 'axios';

import { SoapClient } from '../../common/soap/soap-client';

export const TICIMAX_URUN_SERVICE_PATH = '/Servis/UrunServis.svc';
export const TICIMAX_SIPARIS_SERVICE_PATH = '/Servis/SiparisServis.svc';
export const TICIMAX_DATA_CONTRACT_NS =
  'http://schemas.datacontract.org/2004/07/';
export const TICIMAX_TEMPURI_NS = 'http://tempuri.org/';

export type TicimaxSoapContract = 'IUrunServis' | 'ISiparisServis';

export interface TicimaxCredentials {
  storeUrl: string;
  uyeKodu: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function toFiniteNumber(v: unknown, fallback = 0): number {
  const n =
    typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/** Mağaza URL + Üye Kodu (Ticimax webservis şifresi). */
export function normalizeTicimaxCredentials(
  credentials: Record<string, string>,
): TicimaxCredentials | null {
  const rawUrl = (
    credentials.storeUrl ??
    credentials.apiUrl ??
    credentials.siteUrl ??
    credentials.domain ??
    ''
  ).trim();
  const uyeKodu = (
    credentials.uyeKodu ??
    credentials.apiKey ??
    credentials.memberCode ??
    ''
  ).trim();

  if (!rawUrl || !uyeKodu) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;
  return {
    storeUrl: withProtocol.replace(/\/+$/, ''),
    uyeKodu,
  };
}

export function ticimaxServiceUrl(
  storeUrl: string,
  servicePath: string,
): string {
  const base = storeUrl.replace(/\/+$/, '');
  const path = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;
  return `${base}${path}`;
}

/** WCF DataContract: child fields need an explicit namespace prefix (default xmlns on parent is not enough for list methods). */
function buildDataContractField(
  tag: string,
  value: string | number | boolean,
): string {
  const serialized =
    typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  return `<q:${tag} xmlns:q="${TICIMAX_DATA_CONTRACT_NS}">${escapeDataContractValue(serialized)}</q:${tag}>`;
}

function escapeDataContractValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDataContractStruct(
  wrapperTag: string,
  fields: string[],
): string {
  return `<${wrapperTag}>${fields.join('')}</${wrapperTag}>`;
}

function buildUrunFilterXml(): string {
  return buildDataContractStruct('f', [
    buildDataContractField('Aktif', -1),
    buildDataContractField('Firsat', -1),
    buildDataContractField('Indirimli', -1),
    buildDataContractField('Vitrin', -1),
    buildDataContractField('KategoriID', 0),
    buildDataContractField('MarkaID', 0),
    buildDataContractField('UrunKartiID', 0),
  ]);
}

function buildUrunSayfalamaXml(
  baslangicIndex: number,
  kayitSayisi: number,
): string {
  return buildDataContractStruct('s', [
    buildDataContractField('BaslangicIndex', baslangicIndex),
    buildDataContractField('KayitSayisi', kayitSayisi),
    buildDataContractField('KayitSayisinaGoreGetir', true),
    buildDataContractField('SiralamaDegeri', 'ID'),
    buildDataContractField('SiralamaYonu', 'ASC'),
  ]);
}

function formatTicimaxDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;
}

function buildSiparisFilterXml(since: Date, until: Date): string {
  return buildDataContractStruct('f', [
    buildDataContractField('EntegrasyonAktarildi', -1),
    buildDataContractField('OdemeDurumu', -1),
    buildDataContractField('OdemeTipi', -1),
    buildDataContractField('SiparisDurumu', -1),
    buildDataContractField('SiparisID', 0),
    buildDataContractField('SiparisTarihiBas', formatTicimaxDate(since)),
    buildDataContractField('SiparisTarihiSon', formatTicimaxDate(until)),
    buildDataContractField('UyeID', 0),
    buildDataContractField('UrunGetir', true),
  ]);
}

function buildSiparisSayfalamaXml(
  baslangicIndex: number,
  kayitSayisi: number,
): string {
  return buildDataContractStruct('s', [
    buildDataContractField('BaslangicIndex', baslangicIndex),
    buildDataContractField('KayitSayisi', kayitSayisi),
    buildDataContractField('SiralamaDegeri', 'ID'),
    buildDataContractField('SiralamaYonu', 'DESC'),
  ]);
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  removeNSPrefix: true,
});

function unwrapSoapBody(parsed: unknown): Record<string, unknown> {
  if (!isRecord(parsed)) {
    return {};
  }
  const envelope =
    parsed.Envelope ??
    parsed['soap:Envelope'] ??
    parsed['SOAP-ENV:Envelope'] ??
    parsed;
  const env = isRecord(envelope) ? envelope : parsed;
  const body = env.Body ?? env['soap:Body'] ?? env['SOAP-ENV:Body'];
  if (!isRecord(body)) {
    return isRecord(parsed) ? parsed : {};
  }

  const fault = body.Fault ?? body['soap:Fault'];
  if (isRecord(fault)) {
    const faultString =
      typeof fault.faultstring === 'string'
        ? fault.faultstring
        : typeof fault.Faultstring === 'string'
          ? fault.Faultstring
          : 'Ticimax SOAP hatası';
    throw new Error(faultString);
  }

  const keys = Object.keys(body);
  if (keys.length === 1) {
    const inner = body[keys[0]];
    if (isRecord(inner)) {
      return inner;
    }
  }
  return body;
}

export function buildTicimaxSoapAction(
  contract: TicimaxSoapContract,
  action: string,
): string {
  return `${TICIMAX_TEMPURI_NS}${contract}/${action}`;
}

export function buildTicimaxSoapEnvelope(
  contract: TicimaxSoapContract,
  action: string,
  innerBody: string,
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="${TICIMAX_TEMPURI_NS}">
      ${innerBody}
    </${action}>
  </soap:Body>
</soap:Envelope>`;
}

export async function callTicimaxSoap(
  serviceUrl: string,
  contract: TicimaxSoapContract,
  action: string,
  innerBody: string,
): Promise<Record<string, unknown>> {
  const envelope = buildTicimaxSoapEnvelope(contract, action, innerBody);
  const soapAction = buildTicimaxSoapAction(contract, action);

  try {
    const { data, status } = await axios.post<string>(serviceUrl, envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${soapAction}"`,
      },
      timeout: 30_000,
      responseType: 'text',
      transformResponse: [(response: unknown) => response],
      validateStatus: () => true,
    });

    const xml = typeof data === 'string' ? data : String(data ?? '');
    const parsed = xmlParser.parse(xml) as unknown;
    const body = unwrapSoapBody(parsed);

    if (status >= 400 && Object.keys(body).length === 0) {
      throw new Error(
        `Ticimax SOAP (${action}): HTTP ${status}${xml ? ` — ${xml.slice(0, 160).replace(/\s+/g, ' ')}` : ''}`,
      );
    }

    return body;
  } catch (error) {
    if (error instanceof Error && !(axios.isAxiosError(error))) {
      throw error;
    }
    const ax = error as AxiosError<string>;
    const snippet =
      typeof ax.response?.data === 'string'
        ? ax.response.data.slice(0, 200).replace(/\s+/g, ' ')
        : '';
    throw new Error(
      `Ticimax SOAP (${action}): ${ax.message}${snippet ? ` — ${snippet}` : ''}`,
    );
  }
}

export function formatTicimaxSoapError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('Hatalı Kullanıcı Kodu')) {
      return 'Ticimax üye kodu geçersiz. Panel → Entegrasyon → Web Servis kodunu kontrol edin.';
    }
    if (msg.includes('ContractFilter mismatch')) {
      return 'Ticimax SOAP yapılandırma hatası. Destek ekibine bildirin.';
    }
    return msg.replace(/^Ticimax SOAP \([^)]+\): /, '');
  }
  return 'Ticimax bağlantısı kurulamadı';
}

function extractSoapResult(
  body: Record<string, unknown>,
  action: string,
): unknown {
  const direct = body[`${action}Result`];
  if (direct !== undefined) {
    return direct;
  }
  const response = body[`${action}Response`];
  if (isRecord(response)) {
    return response[`${action}Result`] ?? response;
  }
  return body;
}

function extractSoapRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (!isRecord(value)) {
    return [];
  }
  for (const key of [
    'UrunKarti',
    'Urun',
    'WebSiparis',
    'WebSiparisUrun',
    'Siparis',
    'Varyasyon',
    'any',
    'diffgram',
    'NewDataSet',
  ]) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }
    if (isRecord(nested)) {
      const innerRows = extractSoapRows(nested);
      if (innerRows.length > 0) {
        return innerRows;
      }
      return [nested];
    }
  }
  return [value];
}

function parseSoapCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (isRecord(value)) {
    for (const v of Object.values(value)) {
      const parsed = parseSoapCount(v);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
}

export interface TicimaxStockUpdate {
  variationId: number;
  quantity: number;
}

export function parseTicimaxVariationId(value: string | undefined | null): number | null {
  const trimmed = String(value ?? '').trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const id = Number.parseInt(trimmed, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function buildStokAdediGuncelleBody(updates: TicimaxStockUpdate[]): string {
  const items = updates
    .map((update) =>
      buildDataContractStruct('Varyasyon', [
        buildDataContractField('ID', update.variationId),
        buildDataContractField(
          'StokAdedi',
          Math.max(0, Math.round(update.quantity)),
        ),
      ]),
    )
    .join('');
  return `<Urunler>${items}</Urunler>`;
}

export interface TicimaxSoapProduct {
  id: string;
  barcode: string;
  /** StokKodu / Kod — SKU eşleştirme için */
  sku: string;
  name: string;
  stockQuantity: number;
  salePrice: number;
  listPrice: number;
  active: boolean;
}

export interface TicimaxSoapOrder {
  id: string;
  orderNo: string;
  status: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingAddress?: string;
  totalAmount: number;
  createdAt: string;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
}

function formatTicimaxAddress(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (!isRecord(value)) {
    return '';
  }
  const parts = [
    value.Adres,
    value.AdresSatir1,
    value.AdresSatir2,
    value.Mahalle,
    value.Semt,
    value.Ilce,
    value.Il,
    value.Ulke,
    value.PostaKodu,
  ]
    .map((part) => String(part ?? '').trim())
    .filter((part) => part.length > 0);
  return parts.join(', ');
}

function mapSoapProduct(row: Record<string, unknown>): TicimaxSoapProduct | null {
  const id = pickNonEmptyString(row.ID, row.Id, row.UrunKartiID, row.UrunID);
  const stokKodu = pickNonEmptyString(row.StokKodu, row.Kod);
  const barkod = pickNonEmptyString(row.Barkod, row.barcode);
  const barcode = pickNonEmptyString(barkod, stokKodu, id);
  const sku = pickNonEmptyString(stokKodu, barkod, id);
  const name = pickNonEmptyString(row.UrunAdi, row.Name, row.ProductName, barcode);
  if (!barcode && !id) {
    return null;
  }
  const salePrice = toFiniteNumber(
    row.SatisFiyati ?? row.IndirimliFiyati ?? row.Fiyat ?? row.SalePrice,
  );
  const listPrice = toFiniteNumber(
    row.PiyasaFiyati ?? row.ListeFiyati ?? row.ListPrice ?? salePrice,
    salePrice,
  );
  const stockQuantity = Math.max(
    0,
    Math.round(toFiniteNumber(row.StokAdedi ?? row.ToplamStokAdedi ?? row.Stock)),
  );
  const activeFlag = row.Aktif ?? row.IsActive;
  const active =
    activeFlag === undefined ||
    activeFlag === true ||
    activeFlag === 1 ||
    activeFlag === '1' ||
    activeFlag === 'true';
  return {
    id: id || barcode,
    barcode: barcode || id,
    sku: sku || barcode || id,
    name: name || barcode,
    stockQuantity,
    salePrice,
    listPrice,
    active,
  };
}

function mapSoapOrder(row: Record<string, unknown>): TicimaxSoapOrder | null {
  const id = String(row.ID ?? row.Id ?? row.SiparisID ?? '');
  const orderNo = String(
    row.SiparisNo ?? row.OrderNo ?? row.SiparisKodu ?? id,
  ).trim();
  if (!id && !orderNo) {
    return null;
  }
  const customerName =
    pickNonEmptyString(
      row.AdiSoyadi,
      row.AdSoyad,
      row.MusteriAdi,
      row.UyeAdi,
    ) || '—';
  const customerPhone = pickNonEmptyString(
    row.Telefon,
    row.UyeTelefon,
    row.CepTelefon,
    row.Gsm,
    row.MobilTelefon,
  );
  const customerEmail = pickNonEmptyString(row.Mail, row.Email, row.UyeMail);
  const shippingAddress = pickNonEmptyString(
    formatTicimaxAddress(row.TeslimatAdresi),
    formatTicimaxAddress(row.KargoAdresi),
    formatTicimaxAddress(row.FaturaAdresi),
    row.TeslimatAdresi,
    row.Adres,
  );
  const status = String(row.Durum ?? row.SiparisDurumu ?? row.Status ?? 'NEW');
  const totalAmount = toFiniteNumber(
    row.ToplamTutar ?? row.OdenecekTutar ?? row.Tutar ?? row.Total,
  );
  const createdRaw =
    row.SiparisTarihi ?? row.OrderDate ?? row.CreatedDate ?? row.Tarih;
  const createdAt =
    typeof createdRaw === 'string' || typeof createdRaw === 'number'
      ? new Date(createdRaw).toISOString()
      : new Date().toISOString();

  const linesRaw = row.Urunler ?? row.SiparisUrunleri ?? row.Items ?? row.Kalemler;
  let lines: unknown[] = [];
  if (Array.isArray(linesRaw)) {
    lines = linesRaw;
  } else if (isRecord(linesRaw)) {
    const nested =
      linesRaw.WebSiparisUrun ?? linesRaw.SiparisUrun ?? linesRaw.Urun;
    lines = Array.isArray(nested) ? nested : isRecord(nested) ? [nested] : [];
  }
  const items = lines
    .map((line) => {
      const li = isRecord(line) ? line : {};
      const sku = pickNonEmptyString(
        li.Barkod,
        li.StokKodu,
        li.UrunKodu,
        li.SKU,
        li.UrunID,
        li.ID,
        orderNo,
      );
      return {
        sku,
        name: pickNonEmptyString(li.UrunAdi, li.Ad, li.Name, sku) || sku,
        quantity: Math.max(
          0,
          Math.round(toFiniteNumber(li.Adet ?? li.Miktar ?? li.Quantity, 0)),
        ),
        unitPrice: toFiniteNumber(
          li.BirimFiyat ??
            li.Fiyat ??
            li.UnitPrice ??
            li.SatisFiyati ??
            (toFiniteNumber(li.Tutar) > 0 && toFiniteNumber(li.Adet) > 0
              ? toFiniteNumber(li.Tutar) / toFiniteNumber(li.Adet)
              : li.Tutar),
        ),
      };
    })
    .filter((item) => item.sku.length > 0);

  return {
    id: id || orderNo,
    orderNo: orderNo || id,
    status,
    customerName,
    customerPhone: customerPhone || undefined,
    customerEmail: customerEmail || undefined,
    shippingAddress: shippingAddress || undefined,
    totalAmount,
    createdAt,
    items,
  };
}

function flattenUrunKartiRows(value: unknown): Record<string, unknown>[] {
  const cards = extractSoapRows(value);
  const rows: Record<string, unknown>[] = [];
  for (const card of cards) {
    const productName = String(card.UrunAdi ?? card.Name ?? '').trim();
    const cardId = String(card.ID ?? card.UrunKartiID ?? card.Id ?? '').trim();
    const variationsRaw = card.Varyasyonlar ?? card.Varyasyon;
    const variations = isRecord(variationsRaw)
      ? variationsRaw.Varyasyon ?? variationsRaw
      : variationsRaw;
    const variationList = Array.isArray(variations)
      ? variations.filter(isRecord)
      : isRecord(variations)
        ? [variations]
        : [];
    if (variationList.length > 0) {
      for (const variation of variationList) {
        rows.push({
          ...variation,
          UrunAdi: productName || variation.UrunAdi,
          UrunKartiID: cardId || variation.UrunKartiID,
        });
      }
      continue;
    }
    rows.push({
      ...card,
      UrunAdi: productName || card.UrunAdi,
      ID: cardId || card.ID,
    });
  }
  return rows;
}

export class TicimaxSoapClient {
  constructor(private readonly config: TicimaxCredentials) {}

  private urunServiceUrl(): string {
    return ticimaxServiceUrl(this.config.storeUrl, TICIMAX_URUN_SERVICE_PATH);
  }

  private siparisServiceUrl(): string {
    return ticimaxServiceUrl(this.config.storeUrl, TICIMAX_SIPARIS_SERVICE_PATH);
  }

  async testConnection(): Promise<boolean> {
    await this.testConnectionDetailed();
    return true;
  }

  async testConnectionDetailed(): Promise<{ productCount: number }> {
    const body = `${SoapClient.escapeElement('UyeKodu', this.config.uyeKodu)}${buildUrunFilterXml()}`;
    const response = await callTicimaxSoap(
      this.urunServiceUrl(),
      'IUrunServis',
      'SelectUrunCount',
      body,
    );
    const count = parseSoapCount(extractSoapResult(response, 'SelectUrunCount'));
    if (count === null || count < 0) {
      throw new Error('Ticimax yanıtı okunamadı');
    }
    return { productCount: count };
  }

  async selectProducts(
    baslangicIndex: number,
    kayitSayisi: number,
  ): Promise<TicimaxSoapProduct[]> {
    const body = `${SoapClient.escapeElement('UyeKodu', this.config.uyeKodu)}${buildUrunFilterXml()}${buildUrunSayfalamaXml(baslangicIndex, kayitSayisi)}`;
    const response = await callTicimaxSoap(
      this.urunServiceUrl(),
      'IUrunServis',
      'SelectUrun',
      body,
    );
    const rows = flattenUrunKartiRows(extractSoapResult(response, 'SelectUrun'));
    return rows
      .map((row) => mapSoapProduct(row))
      .filter((p): p is TicimaxSoapProduct => p !== null);
  }

  async selectOrders(
    since: Date,
    until: Date,
    baslangicIndex: number,
    kayitSayisi: number,
  ): Promise<TicimaxSoapOrder[]> {
    const body = `${SoapClient.escapeElement('UyeKodu', this.config.uyeKodu)}${buildSiparisFilterXml(since, until)}${buildSiparisSayfalamaXml(baslangicIndex, kayitSayisi)}`;
    const response = await callTicimaxSoap(
      this.siparisServiceUrl(),
      'ISiparisServis',
      'SelectSiparis',
      body,
    );
    const rows = extractSoapRows(extractSoapResult(response, 'SelectSiparis'));
    return rows
      .map((row) => mapSoapOrder(row))
      .filter((o): o is TicimaxSoapOrder => o !== null);
  }

  /** StokAdediGuncelle — varyasyon ID + stok adedi listesi */
  async updateStockQuantities(updates: TicimaxStockUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    const body = `${SoapClient.escapeElement('UyeKodu', this.config.uyeKodu)}${buildStokAdediGuncelleBody(updates)}`;
    await callTicimaxSoap(
      this.urunServiceUrl(),
      'IUrunServis',
      'StokAdediGuncelle',
      body,
    );
  }
}
