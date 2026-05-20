export interface MikroStokRow {
  stokKod?: string;
  stokKodu?: string;
  code?: string;
  stokAdi?: string;
  name?: string;
  miktar?: number;
  stokMiktar?: number;
  alisFiyat?: number;
  satisFiyat?: number;
  barcode?: string;
}

export interface MikroStokListeResponse {
  liste?: MikroStokRow[];
  data?: MikroStokRow[];
  items?: MikroStokRow[];
}

export interface MikroSatisFisResponse {
  fisNo?: string;
  id?: string;
  number?: string;
  invoiceNumber?: string;
}
