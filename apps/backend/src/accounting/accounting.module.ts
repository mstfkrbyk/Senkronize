import { Module } from '@nestjs/common';

import { EncryptionModule } from '../common/encryption/encryption.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AccountingController } from './accounting.controller';
import { AccountingCustomerService } from './accounting-customer.service';
import { AccountingInventoryService } from './accounting-inventory.service';
import { AccountingInvoiceService } from './accounting-invoice.service';
import { AccountingLedgerService } from './accounting-ledger.service';
import { AccountingOverdueService } from './accounting-overdue.service';
import { AccountingOverdueTask } from './accounting-overdue.task';

@Module({
  imports: [PrismaModule, InvoiceModule, EncryptionModule],
  controllers: [AccountingController],
  providers: [
    AccountingInvoiceService,
    AccountingCustomerService,
    AccountingInventoryService,
    AccountingLedgerService,
    AccountingOverdueService,
    AccountingOverdueTask,
  ],
  exports: [
    AccountingInvoiceService,
    AccountingCustomerService,
    AccountingInventoryService,
    AccountingLedgerService,
    AccountingOverdueService,
  ],
})
export class AccountingModule {}
