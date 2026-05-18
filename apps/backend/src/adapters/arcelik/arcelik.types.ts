/** Arçelik partner API — OAuth2 client_credentials yanıtı */

export interface ArcelikTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}
