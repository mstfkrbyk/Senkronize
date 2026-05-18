import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { axiosWithRetry, withRateLimit } from './http-retry';

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

  it('should not retry on 400 (bad request)', async () => {
    const err400 = axiosError(400);
    mockedAxios.mockRejectedValueOnce(err400);

    await expect(
      axiosWithRetry({ url: 'https://example.test/bad' }, { backoffMs: 0, maxRetries: 3 }),
    ).rejects.toBe(err400);

    expect(mockedAxios).toHaveBeenCalledTimes(1);
  });

  it('5xx yanıtta exponential backoff beklemeleri uygular', async () => {
    const delays: number[] = [];
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: (...args: unknown[]) => void, ms?: number) => {
        delays.push(Number(ms));
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    mockedAxios
      .mockRejectedValueOnce(axiosError(500))
      .mockRejectedValueOnce(axiosError(500))
      .mockResolvedValueOnce({ data: { ok: true } });

    await axiosWithRetry<{ ok: boolean }>(
      { url: 'https://example.test/retry-5xx' },
      { backoffMs: 1000, maxRetries: 3 },
    );

    expect(mockedAxios).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1000, 2000]);

    setTimeoutSpy.mockRestore();
  });

  it('maksimum retry aşılınca son hatayı fırlatır', async () => {
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: (...args: unknown[]) => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    const err502 = axiosError(502);
    mockedAxios.mockRejectedValue(err502);

    await expect(
      axiosWithRetry({ url: 'https://example.test/fail' }, { backoffMs: 0, maxRetries: 2 }),
    ).rejects.toBe(err502);

    expect(mockedAxios).toHaveBeenCalledTimes(3);

    setTimeoutSpy.mockRestore();
  });
});

describe('withRateLimit', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('token bucket dolunca bekler', async () => {
    jest.useFakeTimers();
    const platform = `rl-${String(Math.random())}`;
    const fn = jest.fn().mockResolvedValue(undefined);

    await withRateLimit(platform, 1, fn);
    const second = withRateLimit(platform, 1, fn);

    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);
    await second;

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
