import { Module, forwardRef } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { PrismaModule } from '../prisma/prisma.module';

import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [PrismaModule, forwardRef(() => OrganizationModule)],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
