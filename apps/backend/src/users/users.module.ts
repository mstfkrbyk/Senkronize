import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogController } from './audit-log.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, AuditLogController],
  providers: [UsersService, RolesGuard],
})
export class UsersModule {}
