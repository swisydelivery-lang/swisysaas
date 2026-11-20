import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

class CustomerUpdateDto {
  @IsBoolean() isActive!: boolean;
}

@Injectable()
export class CustomersService {
  constructor(private db: DbService) {}

  list(officeId: number) {
    return this.db.query(
      `SELECT u.id, u.full_name, u.phone, u.is_active, u.created_at,
              (SELECT count(*)::int FROM orders o WHERE o.customer_id = u.id) AS orders_count
         FROM users u
        WHERE u.office_id = $1 AND u.role = 'customer'
        ORDER BY u.id DESC`,
      [officeId],
    );
  }

  async setActive(officeId: number, id: number, isActive: boolean) {
    const rows = await this.db.query(
      `UPDATE users SET is_active = $3
        WHERE id = $1 AND office_id = $2 AND role = 'customer'
        RETURNING id, full_name, phone, is_active`,
      [id, officeId, isActive],
    );
    if (rows.length === 0) throw new NotFoundException('Customer not found');
    return rows[0];
  }
}

function officeOf(req: AuthedRequest): number {
  const officeId = req.user?.officeId;
  if (!officeId) throw new ForbiddenException('No office');
  return officeId;
}

@Controller('customers')
@UseGuards(AuthGuard)
@Roles('admin')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.customers.list(officeOf(req));
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CustomerUpdateDto,
  ) {
    return this.customers.setActive(officeOf(req), id, dto.isActive);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
