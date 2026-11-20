import {
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

@Injectable()
export class PendingService {
  constructor(private db: DbService) {}

  async ids(officeId: number): Promise<number[]> {
    const rows = await this.db.query<{ id: number }>(
      `SELECT id FROM orders
        WHERE office_id = $1 AND status = 'pending'
        ORDER BY id`,
      [officeId],
    );
    return rows.map((r) => r.id);
  }
}

@Controller('orders')
@UseGuards(AuthGuard)
@Roles('driver')
export class PendingController {
  constructor(private pending: PendingService) {}

  @Get('pending')
  ids(@Req() req: AuthedRequest) {
    const officeId = req.user?.officeId;
    if (!officeId) throw new ForbiddenException('No office');
    return this.pending.ids(officeId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [PendingController],
  providers: [PendingService],
})
export class PendingModule {}
