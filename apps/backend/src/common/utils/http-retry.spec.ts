import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { axiosWithRetry } from './http-retry';

jest.mock('axios');

const mockedAxios = axios as jest.MockedFunction<typeof axios>;

function axiosError(status: number): AxiosError {
  const err = new Error(`HTTP ${String(status)}`) as AxiosError;
  err.isAxiosError = true;
  const cfg = { headers: {} } as InternalAxiosRequestConfig;
  err.response = {
    data: {},
    status,
    statusText: String(status),
    headers: {},
    config: cfg,
  };
  return err;
}

describe('axiosWithRetry', () => {
  beforeEach(() => {
    mockedAxios.mockReset();
  });

  it('should succeed on first attempt', async () => {
    mockedAxios.mockResolvedValueOnce({ data: { ok: true } });

    const result = await axiosWithRetry<{ ok: boolean }>(
      { url: 'https://example.test/api' },
      { backoffMs: 0 },
    );

    expect(result).toEqual({ ok: true });
    expect(mockedAxios).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 and succeed', async () => {
    mockedAxios
      .mockRejectedValueOnce(axiosError(429))
      .mockResolvedValueOnce({ data: 'recovered' });

    const result = await axiosWithRetry<string>(
      { url: 'https://example.test/rate' },
      { backoffMs: 0, maxRetries: 3 },
    );

    expect(result).toBe('recovered');
    expect(mockedAxios).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    const err503 = axiosError(503);
    mockedAxios.mockRejectedValue(err503);

    await expect(
      axiosWithRetry({ url: 'https://example.test/down' }, { backoffMs: 0, maxRetries: 2 }),
    ).rejects.toBe(err503);

    expect(mockedAxios).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 400 (bad request)', async () => {
    const err400 = axiosError(400);
    mockedAxios.mockRejectedValueOnce(err400);

    await expect(
      axiosWithRetry({ url: 'https://example.test/bad' }, { backoffMs: 0, maxRetries: 3 }),
    ).rejects.toBe(err400);

    expect(mockedAxios).toHaveBeenCalledTimes(1);
  });
});
