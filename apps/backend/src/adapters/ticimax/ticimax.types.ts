/** Ticimax SOAP yanıtı — yalnızca bağlantı testi için gevşek yapı */
export interface TicimaxSoapEnvelope {
  Envelope?: {
    Body?: Record<string, unknown>;
  };
}
