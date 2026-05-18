/** Senkronizasyon / pazaryeri API çağrısı kalıcı olarak başarısız olduğunda */
export class SyncFailedError extends Error {
  override readonly name = 'SyncFailedError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
