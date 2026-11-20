import {
  Body,
  Controller,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

class ResetDto {
  @IsString() @MinLength(6) password!: string;
}

@Injectable()
export class AdminResetService {
  constructor(private db: DbService) {}

  async reset(officeId: number, password: string) {
    const hash = await bcrypt.hash(password, 10);
    const rows = await this.db.query(
      `UPDATE users SET password_hash = $2
        WHERE office_id = $1 AND role = 'admin'
        RETURNING id, full_name, phone`,
      [officeId, hash],
    );
    if (rows.length === 0) throw new NotFoundException('Admin not found');
    return rows;
  }
}

@Controller('offices')
@UseGuards(AuthGuard)
@Roles('super_admin')
export class AdminResetController {
  constructor(private svc: AdminResetService) {}

  @Post(':id/admin-password')
  reset(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetDto) {
    return this.svc.reset(id, dto.password);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminResetController],
  providers: [AdminResetService],
})
export class AdminResetModule {}
