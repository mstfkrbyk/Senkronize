import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { role?: UserRole } }>();
    if (req.user?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin erişimi gerekiyor');
    }
    return true;
  }
}
