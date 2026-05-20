import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(
    public readonly platform: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `${platform} API hız limiti aşıldı`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class MaxRetriesExceededException extends Error {
  constructor(message = 'Maksimum yeniden deneme sayısı aşıldı') {
    super(message);
    this.name = 'MaxRetriesExceededException';
  }
}

export class CircuitBreakerOpenException extends HttpException {
  constructor(
    public readonly platform: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: `${platform} geçici olarak devre dışı (yüksek hata oranı)`,
        retryAfterSeconds,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
