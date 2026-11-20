import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { OfficesModule } from './offices/offices.module';
import { AdminResetModule } from './offices/admin-reset.module';
import { DriversModule } from './drivers/drivers.module';
import { OrdersModule } from './orders/orders.module';
import { CustomerCancelModule } from './orders/customer-cancel.module';
import { PendingModule } from './orders/pending.module';
import { ImportModule } from './orders/import.module';
import { CustomersModule } from './customers/customers.module';
import { ReportsModule } from './reports/reports.module';
import { OrdersExportModule } from './reports/orders-export.module';
import { PublicModule } from './public/public.module';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    OfficesModule,
    AdminResetModule,
    DriversModule,
    OrdersModule,
    CustomerCancelModule,
    PendingModule,
    ImportModule,
    CustomersModule,
    ReportsModule,
    OrdersExportModule,
    PublicModule,
    FinanceModule,
  ],
})
export class AppModule {}
