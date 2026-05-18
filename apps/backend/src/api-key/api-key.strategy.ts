import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';

import { ApiKeyService } from './api-key.service';
import type { ApiKeyAuthUser } from './api-key.types';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly apiKeyService: ApiKeyService) {
    super();
  }

  async validate(req: Request): Promise<ApiKeyAuthUser> {
    const user = await this.apiKeyService.authenticateRequest(req);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
