import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Sunucu hatası';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const raw = (res as { message?: string | string[] }).message;
        if (Array.isArray(raw)) {
          message = raw;
        } else if (typeof raw === 'string') {
          message = raw;
        }
      }
    } else if (exception instanceof Error) {
      message = isProduction ? 'Sunucu hatası' : exception.message;
      if (isProduction) {
        this.logger.error(exception.message);
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else {
      this.logger.error('Beklenmeyen hata', { exception });
    }

    const body: {
      message: string | string[];
      statusCode: number;
      timestamp: string;
      path: string;
    } = {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: typeof request.url === 'string' ? request.url : '',
    };

    response.status(statusCode).json(body);
  }
}
