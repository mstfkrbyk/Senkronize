import {
  buildTicimaxSoapAction,
  buildTicimaxSoapEnvelope,
  normalizeTicimaxCredentials,
  ticimaxServiceUrl,
  TICIMAX_URUN_SERVICE_PATH,
} from './ticimax-soap.util';

describe('ticimax-soap.util', () => {
  describe('buildTicimaxSoapAction', () => {
    it('uses IUrunServis contract in SOAPAction', () => {
      expect(buildTicimaxSoapAction('IUrunServis', 'SelectUrunCount')).toBe(
        'http://tempuri.org/IUrunServis/SelectUrunCount',
      );
    });
  });

  describe('buildTicimaxSoapEnvelope', () => {
    it('wraps datacontract filter payload with prefixed fields', () => {
      const xml = buildTicimaxSoapEnvelope(
        'IUrunServis',
        'SelectUrunCount',
        '<UyeKodu>x</UyeKodu><f><q:Aktif xmlns:q="http://schemas.datacontract.org/2004/07/">-1</q:Aktif></f>',
      );
      expect(xml).toContain('<SelectUrunCount xmlns="http://tempuri.org/">');
      expect(xml).toContain('xmlns:q="http://schemas.datacontract.org/2004/07/"');
    });
  });

  describe('normalizeTicimaxCredentials', () => {
    it('requires storeUrl and uyeKodu', () => {
      expect(normalizeTicimaxCredentials({ storeUrl: 'https://shop.test' })).toBeNull();
      expect(normalizeTicimaxCredentials({ uyeKodu: 'abc' })).toBeNull();
    });

    it('accepts storeUrl + uyeKodu', () => {
      expect(
        normalizeTicimaxCredentials({
          storeUrl: 'https://mixelektrik.com.tr',
          uyeKodu: 'secret-code',
        }),
      ).toEqual({
        storeUrl: 'https://mixelektrik.com.tr',
        uyeKodu: 'secret-code',
      });
    });

    it('adds https protocol and maps legacy apiKey', () => {
      expect(
        normalizeTicimaxCredentials({
          storeUrl: 'mixelektrik.com.tr',
          apiKey: 'legacy-key',
        }),
      ).toEqual({
        storeUrl: 'https://mixelektrik.com.tr',
        uyeKodu: 'legacy-key',
      });
    });
  });

  describe('ticimaxServiceUrl', () => {
    it('builds UrunServis endpoint', () => {
      expect(
        ticimaxServiceUrl('https://mixelektrik.com.tr', TICIMAX_URUN_SERVICE_PATH),
      ).toBe('https://mixelektrik.com.tr/Servis/UrunServis.svc');
    });
  });
});
