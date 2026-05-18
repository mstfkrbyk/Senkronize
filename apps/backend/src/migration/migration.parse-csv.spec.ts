import { parseCsvRows } from './migration.parse-csv';

describe('parseCsvRows', () => {
  it('virgüllü CSV parse etmeli', () => {
    const csv = `barcode,name,price,stock
111,Elma,12.5,10`;

    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      barcode: '111',
      name: 'Elma',
      salePrice: 12.5,
      stock: 10,
    });
  });

  it('noktalı virgüllü CSV parse etmeli', () => {
    const csv = `barkod;ad;fiyat;stok
222;Armut;9;3`;

    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      barcode: '222',
      name: 'Armut',
      salePrice: 9,
      stock: 3,
    });
  });

  it('Türkçe başlıklar ile çalışmalı', () => {
    const csv = `Barkod,Ürün Adı,Satış Fiyatı,Stok
333,Kiraz,44,7`;

    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      barcode: '333',
      name: 'Kiraz',
      salePrice: 44,
      stock: 7,
    });
  });

  it('eksik zorunlu alan olan satırı atlamalı', () => {
    const csv = `barcode,name,price
,No Barkod,10
444,,20`;

    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(0);
  });
});
