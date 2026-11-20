import {
  ConflictException,
  Controller,
  ForbiddenException,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

@Injectable()
export class CustomerCancelService {
  constructor(private db: DbService) {}

  async cancel(userId: number, officeId: number, id: number) {
    const rows = await this.db.query(
      `UPDATE orders SET status = 'cancelled'
        WHERE id = $1 AND customer_id = $2 AND office_id = $3
          AND status = 'pending'
        RETURNING id, status`,
      [id, userId, officeId],
    );
    if (rows.length === 0) {
      throw new ConflictException('Order cannot be cancelled');
    }
    return rows[0];
  }
}

@Controller('orders')
@UseGuards(AuthGuard)
@Roles('customer')
export class CustomerCancelController {
  constructor(private svc: CustomerCancelService) {}

  @Post(':id/cancel')
  cancel(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    const u = req.user;
    if (!u || !u.officeId) throw new ForbiddenException('No office');
    return this.svc.cancel(u.id, u.officeId, id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CustomerCancelController],
  providers: [CustomerCancelService],
})
export class CustomerCancelModule {}
