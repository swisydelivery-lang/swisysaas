import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';

class CreateDriverDto {
  @IsString() @MinLength(2) fullName!: string;
  @Matches(/^\d{8,15}$/, { message: 'phone must be 8-15 digits' })
  phone!: string;
  @IsString() @MinLength(6) password!: string;
}

class UpdateDriverDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}

@Injectable()
export class DriversService {
  constructor(private db: DbService) {}

  async create(officeId: number, input: CreateDriverDto) {
    const hash = await bcrypt.hash(input.password, 10);
    try {
      return await this.db.transaction(async (client) => {
        const o = await client.query(
          'SELECT max_drivers FROM offices WHERE id = $1 FOR UPDATE',
          [officeId],
        );
        const max: number = o.rows[0].max_drivers;
        const c = await client.query(
          `SELECT count(*)::int AS n FROM users
            WHERE office_id = $1 AND role = 'driver'`,
          [officeId],
        );
        if (c.rows[0].n >= max) {
          throw new ForbiddenException('Drivers limit reached');
        }
        const r = await client.query(
          `INSERT INTO users (office_id, role, full_name, phone, password_hash)
           VALUES ($1, 'driver', $2, $3, $4)
           RETURNING id, full_name, phone, is_active`,
          [officeId, input.fullName, input.phone, hash],
        );
        return r.rows[0];
      });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('Phone number already used');
      }
      throw e;
    }
  }

  list(officeId: number) {
    return this.db.query(
      `SELECT id, full_name, phone, is_active, created_at
         FROM users WHERE office_id = $1 AND role = 'driver' ORDER BY id`,
      [officeId],
    );
  }

  async update(officeId: number, id: number, input: UpdateDriverDto) {
    const hash = input.password ? await bcrypt.hash(input.password, 10) : null;
    const rows = await this.db.query(
      `UPDATE users SET
         is_active = COALESCE($3::boolean, is_active),
         password_hash = COALESCE($4::text, password_hash)
       WHERE id = $1 AND office_id = $2 AND role = 'driver'
       RETURNING id, full_name, phone, is_active`,
      [id, officeId, input.isActive ?? null, hash],
    );
    if (rows.length === 0) throw new NotFoundException('Driver not found');
    return rows[0];
  }
}

function officeOf(req: AuthedRequest): number {
  const officeId = req.user?.officeId;
  if (!officeId) throw new ForbiddenException('No office');
  return officeId;
}

@Controller('drivers')
@UseGuards(AuthGuard)
@Roles('admin')
export class DriversController {
  constructor(private drivers: DriversService) {}

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateDriverDto) {
    return this.drivers.create(officeOf(req), dto);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.drivers.list(officeOf(req));
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.drivers.update(officeOf(req), id, dto);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
