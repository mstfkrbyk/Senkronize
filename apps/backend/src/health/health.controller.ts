import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Sağlık kontrolü' })
  async check(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    version: string;
    services: { database: 'up' | 'down' };
  }> {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      services: {
        database: dbOk ? 'up' : 'down',
      },
    };
  }
}
