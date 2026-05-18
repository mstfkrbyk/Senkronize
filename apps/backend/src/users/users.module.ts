import { Module, forwardRef } from '@nestjs/common';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationModule } from '../notification/notification.module';
import { AuditLogController } from './audit-log.controller';
import { AuditLogsController } from './audit-logs.controller';
import { UsersController } from './users.controller';
import { UserInviteService } from './user-invite.service';
import { UsersService } from './users.service';

@Module({
  imports: [ApiKeyModule, forwardRef(() => AuthModule), NotificationModule],
  controllers: [UsersController, AuditLogController, AuditLogsController],
  providers: [UsersService, UserInviteService, RolesGuard],
  exports: [UsersService, UserInviteService],
})
export class UsersModule {}
