import type { CreateShipmentParams, ICargoAdapter } from '../cargo-adapter.interface';
import { RestApiKeyCargoAdapter } from './cargo-rest-api-key.adapter';

const HERMES_CONFIG = {
  loggerName: 'HermesCargoAdapter',
  defaultBase: 'https://api.hermes.co.uk/v1',
  createPath: 'deliveries',
  trackPath: 'deliveries/{trackingNo}/track',
  cancelPath: 'deliveries/cancel',
  labelPath: 'deliveries/{trackingNo}/label',
  createBodyBuilder: (params: CreateShipmentParams): Record<string, unknown> => ({
    deliveryType: 'B2C',
    customerReference: params.orderId,
    destination: {
      name: params.receiverName,
      phone: params.receiverPhone,
      address: params.receiverAddress,
      town: params.receiverCity,
      postcode: params.receiverDistrict,
    },
    parcels: [{ weight: params.weight, desi: params.desi ?? params.weight }],
    deliveryInstructions: params.notes ?? '',
  }),
} as const;

export class HermesCargoAdapter extends RestApiKeyCargoAdapter implements ICargoAdapter {
  constructor(creds: Record<string, unknown>) {
    super(creds, HERMES_CONFIG);
  }
}
