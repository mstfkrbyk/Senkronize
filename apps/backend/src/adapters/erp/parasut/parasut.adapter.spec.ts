import axios from 'axios';

import { ParasutErpAdapter } from './parasut.adapter';
import { ParasutOAuthService } from './parasut.oauth';

jest.mock('axios');
jest.mock('../../../common/utils/http-retry', () => ({
  axiosWithRetry: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { axiosWithRetry } = jest.requireMock('../../../common/utils/http-retry') as {
  axiosWithRetry: jest.Mock;
};

describe('ParasutErpAdapter', () => {
  const credentials = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    companyId: '12345',
  };

  let oauth: ParasutOAuthService;
  let adapter: ParasutErpAdapter;
  let mockClient: {
    get: jest.Mock;
    post: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    oauth = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
      invalidate: jest.fn(),
    } as unknown as ParasutOAuthService;
    adapter = new ParasutErpAdapter(oauth);

    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockClient as unknown as ReturnType<typeof axios.create>);
    axiosWithRetry.mockResolvedValue({ access_token: 'access-token', expires_in: 3600 });
  });

  it('should push invoice and return invoice ID', async () => {
    mockClient.get.mockResolvedValueOnce({
      data: { data: [{ id: 'contact-1', attributes: { name: 'Müşteri' } }] },
    });
    mockClient.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 'invoice-99',
          attributes: {
            invoice_no: 'FTR-99',
            currency: 'TRL',
            issue_date: '2026-05-20',
            gross_total: 240,
          },
        },
      },
    });

    const invoiceId = await adapter.pushInvoice(credentials, {
      externalId: 'ORD-100',
      currency: 'TRL',
      customer: { name: 'Test Müşteri' },
      items: [
        { title: 'Ürün A', quantity: 2, price: 100 },
        { title: 'Ürün B', quantity: 1, price: 40 },
      ],
    });

    expect(invoiceId).toBe('invoice-99');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/sales_invoices',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'sales_invoices',
          attributes: expect.objectContaining({
            lines: expect.arrayContaining([
              expect.objectContaining({ description: 'Ürün A', quantity: 2 }),
            ]),
          }),
          relationships: {
            contact: { data: { id: 'contact-1', type: 'contacts' } },
          },
        }),
      }),
    );
  });

  it('should find or create contact', async () => {
    mockClient.get.mockResolvedValueOnce({
      data: { data: [] },
    });
    mockClient.post.mockResolvedValueOnce({
      data: {
        data: { id: 'contact-new', attributes: { name: 'Yeni Müşteri' } },
      },
    });

    const contactId = await adapter.findOrCreateContact(credentials, {
      name: 'Yeni Müşteri',
      email: 'test@example.com',
    });

    expect(contactId).toBe('contact-new');
    expect(mockClient.get).toHaveBeenCalledWith('/contacts', {
      params: expect.objectContaining({ 'filter[name]': 'Yeni Müşteri' }),
    });
    expect(mockClient.post).toHaveBeenCalledWith('/contacts', {
      data: expect.objectContaining({
        type: 'contacts',
        attributes: expect.objectContaining({
          name: 'Yeni Müşteri',
          email: 'test@example.com',
        }),
      }),
    });
  });

  it('should return existing contact when filter matches', async () => {
    mockClient.get.mockResolvedValueOnce({
      data: {
        data: [{ id: 'contact-existing', attributes: { name: 'Mevcut' } }],
      },
    });

    const contactId = await adapter.findOrCreateContact(credentials, {
      name: 'Mevcut',
    });

    expect(contactId).toBe('contact-existing');
    expect(mockClient.post).not.toHaveBeenCalled();
  });
});
