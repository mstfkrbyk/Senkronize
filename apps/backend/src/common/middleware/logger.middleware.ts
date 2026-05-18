import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'GET' && req.path.includes('health')) {
      next();
      return;
    }
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        this.logger.warn(
          `SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`,
        );
      }
    });
    next();
  }
}
