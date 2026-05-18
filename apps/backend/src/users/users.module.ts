import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationModule } from '../notification/notification.module';
import { AuditLogController } from './audit-log.controller';
import { AuditLogsController } from './audit-logs.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [UsersController, AuditLogController, AuditLogsController],
  providers: [UsersService, RolesGuard],
})
export class UsersModule {}
