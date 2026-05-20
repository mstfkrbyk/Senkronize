import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService } from './health.service';
import type { DetailedHealthResponse } from './health.service';

const APP_VERSION = '0.1.0';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Sağlık kontrolü' })
  async check(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    version: string;
    services: { database: 'up' | 'down' };
  }> {
    const db = await this.healthService.checkDb();

    return {
      status: db.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? APP_VERSION,
      services: {
        database: db.status === 'up' ? 'up' : 'down',
      },
    };
  }

  @Get('health/detailed')
  @SkipThrottle()
  @ApiOperation({ summary: 'Detaylı platform sağlık durumu' })
  async detailedHealth(): Promise<DetailedHealthResponse> {
    return this.healthService.getDetailedHealth();
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
