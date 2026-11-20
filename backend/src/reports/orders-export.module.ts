import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class OrdersExportService {
  constructor(private db: DbService) {}

  async rows(officeId: number, from: string, to: string) {
    if (!DATE.test(from) || !DATE.test(to) || from > to) {
      throw new BadRequestException('Invalid dates');
    }
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366) {
      throw new BadRequestException('Range too long');
    }
    return this.db.query(
      `SELECT o.id,
              to_char(o.created_at AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD HH24:MI') AS created,
              o.customer_phone, o.customer_name, o.order_text,
              o.pickup_address, o.extra_pickups, o.dropoff_address,
              o.delivery_fee, o.calculated_fee, o.fee_overridden,
              o.status::text AS status, u.full_name AS driver,
              round(o.delivery_fee * o.commission_percent / 100, 2) AS commission
         FROM orders o LEFT JOIN users u ON u.id = o.driver_id
        WHERE o.office_id = $1
          AND (o.created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN $2::date AND $3::date
        ORDER BY o.id
        LIMIT 5000`,
      [officeId, from, to],
    );
  }
}

@Controller('reports')
@UseGuards(AuthGuard)
@Roles('admin')
export class OrdersExportController {
  constructor(private svc: OrdersExportService) {}

  @Get('orders')
  rows(
    @Req() req: AuthedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const officeId = req.user?.officeId;
    if (!officeId) throw new ForbiddenException('No office');
    return this.svc.rows(officeId, from ?? '', to ?? '');
  }
}

@Module({
  imports: [AuthModule],
  controllers: [OrdersExportController],
  providers: [OrdersExportService],
})
export class OrdersExportModule {}
