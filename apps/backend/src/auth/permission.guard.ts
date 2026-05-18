import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { ROLE_PERMISSIONS, Permission } from './permissions';
import { PERMISSION_KEY } from './requires-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as
      | { role: UserRole }
      | undefined;
    if (!user) {
      return false;
    }

    const granted = ROLE_PERMISSIONS[user.role] ?? [];
    if (!granted.includes(required)) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }
    return true;
  }
}
