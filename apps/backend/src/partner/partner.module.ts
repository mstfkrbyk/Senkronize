import { Module } from '@nestjs/common';

import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';

import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
