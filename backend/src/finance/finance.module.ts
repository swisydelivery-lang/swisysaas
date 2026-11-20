import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthUser, AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

class PaymentDto {
  @IsInt() driverId!: number;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() note?: string;
}

class CommissionDto {
  @IsNumber() @Min(0) @Max(100) percent!: number;
}

@Injectable()
export class FinanceService {
  constructor(private db: DbService) {}

  summary(officeId: number, driverId: number | null) {
    return this.db.query(
      `SELECT u.id, u.full_name, u.phone,
              COALESCE(o.cnt, 0)::int AS delivered_orders,
              COALESCE(o.due, 0) AS due,
              COALESCE(p.paid, 0) AS paid,
              COALESCE(o.due, 0) - COALESCE(p.paid, 0) AS balance
         FROM users u
         LEFT JOIN (
           SELECT driver_id, count(*) AS cnt,
                  SUM(round(delivery_fee * commission_percent / 100, 2)) AS due
             FROM orders
            WHERE office_id = $1 AND status = 'delivered'
            GROUP BY driver_id) o ON o.driver_id = u.id
         LEFT JOIN (
           SELECT driver_id, SUM(amount) AS paid
             FROM driver_payments
            WHERE office_id = $1
            GROUP BY driver_id) p ON p.driver_id = u.id
        WHERE u.office_id = $1 AND u.role = 'driver'
          AND ($2::int IS NULL OR u.id = $2::int)
        ORDER BY u.id`,
      [officeId, driverId],
    );
  }

  async pay(user: AuthUser, dto: PaymentDto) {
    const officeId = user.officeId as number;
    const drivers = await this.db.query(
      `SELECT id FROM users
        WHERE id = $1 AND office_id = $2 AND role = 'driver'`,
      [dto.driverId, officeId],
    );
    if (drivers.length === 0) {
      throw new BadRequestException('Driver not found in this office');
    }
    const rows = await this.db.query(
      `INSERT INTO driver_payments (office_id, driver_id, amount, note, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, driver_id, amount, note, created_at`,
      [officeId, dto.driverId, dto.amount, dto.note ?? null, user.id],
    );
    return rows[0];
  }

  async getCommission(officeId: number) {
    const rows = await this.db.query(
      'SELECT commission_percent FROM offices WHERE id = $1',
      [officeId],
    );
    return rows[0];
  }

  async setCommission(officeId: number, percent: number) {
    const rows = await this.db.query(
      `UPDATE offices SET commission_percent = $2 WHERE id = $1
       RETURNING commission_percent`,
      [officeId, percent],
    );
    return rows[0];
  }
}

function userOf(req: AuthedRequest): AuthUser {
  if (!req.user || !req.user.officeId) throw new ForbiddenException('No office');
  return req.user;
}

@Controller('finance')
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get('drivers')
  @Roles('admin')
  drivers(@Req() req: AuthedRequest) {
    return this.finance.summary(userOf(req).officeId as number, null);
  }

  @Get('me')
  @Roles('driver')
  async me(@Req() req: AuthedRequest) {
    const u = userOf(req);
    const rows = await this.finance.summary(u.officeId as number, u.id);
    return rows[0];
  }

  @Post('payments')
  @Roles('admin')
  pay(@Req() req: AuthedRequest, @Body() dto: PaymentDto) {
    return this.finance.pay(userOf(req), dto);
  }

  @Get('commission')
  @Roles('admin')
  getCommission(@Req() req: AuthedRequest) {
    return this.finance.getCommission(userOf(req).officeId as number);
  }

  @Patch('commission')
  @Roles('admin')
  setCommission(@Req() req: AuthedRequest, @Body() dto: CommissionDto) {
    return this.finance.setCommission(userOf(req).officeId as number, dto.percent);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}

