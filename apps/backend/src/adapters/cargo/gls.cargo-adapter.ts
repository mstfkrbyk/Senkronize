import type { CreateShipmentParams, ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const GLS_CONFIG = {
  loggerName: 'GlsCargoAdapter',
  defaultBase: 'https://api.gls-group.eu/public/v3',
  createPath: 'parcels',
  trackPath: 'parcels/{trackingNo}/track',
  cancelPath: 'parcels/cancel',
  labelPath: 'parcels/{trackingNo}/label',
  createBodyBuilder: (params: CreateShipmentParams): Record<string, unknown> => ({
    reference: params.orderId,
    consignee: {
      name: params.receiverName,
      phone: params.receiverPhone,
      street: params.receiverAddress,
      city: params.receiverCity,
      zip: params.receiverDistrict,
    },
    weight: params.weight,
    comment: params.notes ?? '',
  }),
} as const;

export class GlsCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, GLS_CONFIG);
  }
}
