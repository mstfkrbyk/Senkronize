import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { SuperAdminGuard } from './admin.guard';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminController],
  providers: [SuperAdminGuard],
})
export class AdminModule {}
