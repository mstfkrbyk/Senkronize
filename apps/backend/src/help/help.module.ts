import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { HelpAdminController } from './help-admin.controller';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

@Module({
  imports: [PrismaModule, AuthModule, AdminModule],
  controllers: [HelpController, HelpAdminController],
  providers: [HelpService],
  exports: [HelpService],
})
export class HelpModule {}
