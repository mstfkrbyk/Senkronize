import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';

@Injectable()
export class PostHogService implements OnModuleDestroy {
  private readonly client: PostHog;

  constructor(private readonly config: ConfigService) {
    this.client = new PostHog(config.get('POSTHOG_API_KEY', ''), {
      host: config.get('POSTHOG_HOST', 'https://eu.posthog.com'),
    });
  }

  capture(
    distinctId: string,
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.config.get('POSTHOG_API_KEY')) {
      return;
    }
    this.client.capture({ distinctId, event, properties });
  }

  identify(distinctId: string, properties: Record<string, unknown>): void {
    if (!this.config.get('POSTHOG_API_KEY')) {
      return;
    }
    this.client.identify({ distinctId, properties });
  }

  groupCapture(
    orgId: string,
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.config.get('POSTHOG_API_KEY')) {
      return;
    }
    this.client.capture({
      distinctId: `org_${orgId}`,
      event,
      groups: { organization: orgId },
      properties,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.shutdown();
  }
}
