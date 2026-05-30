import { HttpException, HttpStatus } from '@nestjs/common';

export class BizimHesapRateLimitBlockedException extends HttpException {
  constructor(
    public readonly organizationId: string,
    public readonly blockedUntil: Date,
    public readonly retryAfterSeconds: number,
    message: string,
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message,
        retryAfterSeconds,
        blockedUntil: blockedUntil.toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
