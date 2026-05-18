import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';

const APP_VERSION = '0.1.0';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
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
      version: process.env.npm_package_version ?? APP_VERSION,
      services: {
        database: dbOk ? 'up' : 'down',
      },
    };
  }

  @Get('app/version')
  @SkipThrottle()
  @ApiOperation({ summary: 'Desktop uygulama sürüm bilgisi' })
  getAppVersion(): {
    version: string;
    latestVersion: string;
    downloadUrl: string | null;
    releaseNotes: string | null;
  } {
    const current = APP_VERSION;
    return {
      version: current,
      latestVersion: current,
      downloadUrl: null,
      releaseNotes: null,
    };
  }
}
