import { XMLParser } from 'fast-xml-parser';
import axios, { type AxiosError } from 'axios';

export interface BasicAuth {
  username: string;
  password: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

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
  const keys = Object.keys(body);
  if (keys.length === 1) {
    const inner = body[keys[0]];
    if (isRecord(inner)) {
      return inner;
    }
  }
  return body;
}

export class SoapClient {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    removeNSPrefix: true,
  });

  constructor(
    private readonly wsdlUrl: string,
    private readonly auth?: BasicAuth | null,
  ) {}

  private wrapEnvelope(action: string, innerBody: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="http://tempuri.org/">
      ${innerBody}
    </${action}>
  </soap:Body>
</soap:Envelope>`;
  }

  async call(action: string, body: string): Promise<Record<string, unknown>> {
    const envelope = this.wrapEnvelope(action, body);
    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"http://tempuri.org/${action}"`,
    };
    if (this.auth?.username && this.auth.password !== undefined) {
      const authToken = Buffer.from(
        `${this.auth.username}:${this.auth.password}`,
        'utf8',
      ).toString('base64');
      headers.Authorization = `Basic ${authToken}`;
    }

    try {
      const { data } = await axios.post<string>(this.wsdlUrl, envelope, {
        headers: {
          ...headers,
        },
        timeout: 30_000,
        responseType: 'text',
        transformResponse: [(r: unknown) => r],
      });
      const xml = typeof data === 'string' ? data : String(data);
      const parsed = this.xmlParser.parse(xml) as unknown;
      return unwrapSoapBody(parsed);
    } catch (error) {
      throw this.toSoapError(error, action);
    }
  }

  static escapeElement(tag: string, value: string | number): string {
    return `<${tag}>${escapeXml(String(value))}</${tag}>`;
  }

  private toSoapError(error: unknown, action: string): Error {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError<string>;
      const status = ax.response?.status;
      const snippet =
        typeof ax.response?.data === 'string'
          ? ax.response.data.slice(0, 200).replace(/\s+/g, ' ')
          : '';
      if (status) {
        return new Error(
          `Netsis SOAP (${action}): HTTP ${status}${snippet ? ` — ${snippet}` : ''}`,
        );
      }
      if (ax.code === 'ECONNREFUSED') {
        return new Error(
          `Netsis SOAP (${action}): sunucuya bağlanılamadı (${this.wsdlUrl})`,
        );
      }
      return new Error(`Netsis SOAP (${action}): ${ax.message}`);
    }
    return error instanceof Error
      ? error
      : new Error(`Netsis SOAP (${action}): bilinmeyen hata`);
  }
}
