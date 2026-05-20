import { Module } from '@nestjs/common';

import { EncryptionModule } from '../common/encryption/encryption.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AccountingController } from './accounting.controller';
import { AccountingCustomerService } from './accounting-customer.service';
import { AccountingInvoiceService } from './accounting-invoice.service';
import { AccountingLedgerService } from './accounting-ledger.service';

@Module({
  imports: [PrismaModule, InvoiceModule, EncryptionModule],
  controllers: [AccountingController],
  providers: [
    AccountingInvoiceService,
    AccountingCustomerService,
    AccountingLedgerService,
  ],
  exports: [
    AccountingInvoiceService,
    AccountingCustomerService,
    AccountingLedgerService,
  ],
})
export class AccountingModule {}
