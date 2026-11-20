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

interface DriverRow {
  id: number;
  full_name: string;
  delivered_orders: number;
  fees: string;
  commission: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ReportsService {
  constructor(private db: DbService) {}

  async summary(officeId: number, from: string, to: string) {
    if (!DATE.test(from) || !DATE.test(to) || from > to) {
      throw new BadRequestException('Invalid dates');
    }
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366) {
      throw new BadRequestException('Range too long');
    }
    try {
      const created = await this.db.query<{ status: string; n: number }>(
        `SELECT status::text AS status, count(*)::int AS n
           FROM orders
          WHERE office_id = $1
            AND (created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN $2::date AND $3::date
          GROUP BY status`,
        [officeId, from, to],
      );
      const drivers = await this.db.query<DriverRow>(
        `SELECT u.id, u.full_name,
                count(*)::int AS delivered_orders,
                COALESCE(SUM(o.delivery_fee), 0) AS fees,
                COALESCE(SUM(round(o.delivery_fee * o.commission_percent / 100, 2)), 0) AS commission
           FROM orders o JOIN users u ON u.id = o.driver_id
          WHERE o.office_id = $1 AND o.status = 'delivered'
            AND (o.delivered_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN $2::date AND $3::date
          GROUP BY u.id, u.full_name
          ORDER BY commission DESC, u.id`,
        [officeId, from, to],
      );
      const pay = await this.db.query<{ received: string }>(
        `SELECT COALESCE(SUM(amount), 0) AS received
           FROM driver_payments
          WHERE office_id = $1
            AND (created_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN $2::date AND $3::date`,
        [officeId, from, to],
      );
      const byStatus: Record<string, number> = {};
      for (const r of created) byStatus[r.status] = r.n;
      return {
        from,
        to,
        created: created.reduce((a, r) => a + r.n, 0),
        cancelled: byStatus['cancelled'] ?? 0,
        delivered: drivers.reduce((a, d) => a + d.delivered_orders, 0),
        fees: round2(drivers.reduce((a, d) => a + Number(d.fees), 0)),
        commission: round2(drivers.reduce((a, d) => a + Number(d.commission), 0)),
        received: round2(Number(pay[0].received)),
        drivers,
      };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === '22008' || code === '22007') {
        throw new BadRequestException('Invalid dates');
      }
      throw e;
    }
  }
}

@Controller('reports')
@UseGuards(AuthGuard)
@Roles('admin')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('summary')
  summary(
    @Req() req: AuthedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const officeId = req.user?.officeId;
    if (!officeId) throw new ForbiddenException('No office');
    return this.reports.summary(officeId, from ?? '', to ?? '');
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
