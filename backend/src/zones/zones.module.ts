import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
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
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';
import { computeFee } from './fee';
import type { ZonePrice } from './fee';

export interface ZoneSnap {
  pickup: ZonePrice;
  dropoff: ZonePrice;
  extras: ZonePrice[];
  fee: number;
}

class ZoneDto {
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0) @Max(100000) price!: number;
}

class ZoneUpdateDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) price?: number;
}

class ImportDto {
  @IsArray() @ArrayMaxSize(2000) rows!: unknown[];
}

class QuoteDto {
  @IsInt() pickupZoneId!: number;
  @IsInt() dropoffZoneId!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true })
  extraZoneIds?: number[];
}

const isDup = (e: unknown) => (e as { code?: string }).code === '23505';

@Injectable()
export class ZonesService {
  constructor(private db: DbService) {}

  async list(officeId: number, withPrice: boolean) {
    const rows = await this.db.query<{ id: number; name: string; price: string }>(
      'SELECT id, name, price FROM zones WHERE office_id = $1 ORDER BY name',
      [officeId],
    );
    return withPrice ? rows : rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async create(officeId: number, dto: ZoneDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name required');
    try {
      const rows = await this.db.query(
        `INSERT INTO zones (office_id, name, price) VALUES ($1, $2, $3)
         RETURNING id, name, price`,
        [officeId, name, dto.price],
      );
      return rows[0];
    } catch (e) {
      if (isDup(e)) throw new ConflictException('Zone name already used');
      throw e;
    }
  }

  async update(officeId: number, id: number, dto: ZoneUpdateDto) {
    try {
      const rows = await this.db.query(
        `UPDATE zones SET
           name = COALESCE(NULLIF(btrim($3::text), ''), name),
           price = COALESCE($4::numeric, price)
          WHERE id = $1 AND office_id = $2
          RETURNING id, name, price`,
        [id, officeId, dto.name ?? null, dto.price ?? null],
      );
      if (rows.length === 0) throw new NotFoundException('Zone not found');
      return rows[0];
    } catch (e) {
      if (isDup(e)) throw new ConflictException('Zone name already used');
      throw e;
    }
  }

  async remove(officeId: number, id: number) {
    const rows = await this.db.query(
      'DELETE FROM zones WHERE id = $1 AND office_id = $2 RETURNING id',
      [id, officeId],
    );
    if (rows.length === 0) throw new NotFoundException('Zone not found');
    return { ok: true };
  }

  async importRows(officeId: number, rows: unknown[]) {
    const errors: { row: number; reason: string }[] = [];
    const valid: { name: string; price: number }[] = [];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const rec = (r ?? {}) as { name?: unknown; price?: unknown };
      const name = String(rec.name ?? '').trim();
      const price = Number(String(rec.price ?? '').replace(',', '.'));
      if (!name) {
        errors.push({ row: i + 1, reason: 'name is empty' });
        return;
      }
      if (!Number.isFinite(price) || price < 0 || price > 100000) {
        errors.push({ row: i + 1, reason: 'invalid price' });
        return;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        errors.push({ row: i + 1, reason: 'duplicate name in file' });
        return;
      }
      seen.add(key);
      valid.push({ name, price });
    });
    let added = 0;
    let updated = 0;
    await this.db.transaction(async (client) => {
      for (const z of valid) {
        const r = await client.query(
          `INSERT INTO zones (office_id, name, price) VALUES ($1, $2, $3)
           ON CONFLICT (office_id, lower(btrim(name)))
           DO UPDATE SET price = EXCLUDED.price
           RETURNING (xmax = 0) AS inserted`,
          [officeId, z.name, z.price],
        );
        if (r.rows[0].inserted) added += 1;
        else updated += 1;
      }
    });
    return { added, updated, errors };
  }

  async resolve(
    officeId: number,
    pickupId: number,
    dropoffId: number,
    extraIds: number[],
  ): Promise<ZoneSnap> {
    const ids = Array.from(new Set([pickupId, dropoffId, ...extraIds]));
    const rows = await this.db.query<{ id: number; name: string; price: string }>(
      'SELECT id, name, price FROM zones WHERE office_id = $1 AND id = ANY($2::int[])',
      [officeId, ids],
    );
    const map = new Map<number, ZonePrice>(
      rows.map((r) => [r.id, { name: r.name, price: Number(r.price) }] as [number, ZonePrice]),
    );
    const pickup = map.get(pickupId);
    const dropoff = map.get(dropoffId);
    if (!pickup || !dropoff) throw new BadRequestException('Zone not found');
    const extras: ZonePrice[] = [];
    for (const id of extraIds) {
      const z = map.get(id);
      if (!z) throw new BadRequestException('Zone not found');
      extras.push(z);
    }
    return { pickup, dropoff, extras, fee: computeFee(pickup, dropoff, extras) };
  }
}

function officeOf(req: AuthedRequest): number {
  const officeId = req.user?.officeId;
  if (!officeId) throw new ForbiddenException('No office');
  return officeId;
}

@Controller('zones')
@UseGuards(AuthGuard)
export class ZonesController {
  constructor(private zones: ZonesService) {}

  @Get()
  @Roles('admin', 'driver', 'customer')
  list(@Req() req: AuthedRequest) {
    return this.zones.list(officeOf(req), req.user?.role === 'admin');
  }

  @Post()
  @Roles('admin')
  create(@Req() req: AuthedRequest, @Body() dto: ZoneDto) {
    return this.zones.create(officeOf(req), dto);
  }

  @Post('import')
  @Roles('admin')
  importRows(@Req() req: AuthedRequest, @Body() dto: ImportDto) {
    return this.zones.importRows(officeOf(req), dto.rows);
  }

  @Post('quote')
  @Roles('admin', 'driver', 'customer')
  async quote(@Req() req: AuthedRequest, @Body() dto: QuoteDto) {
    const z = await this.zones.resolve(
      officeOf(req),
      dto.pickupZoneId,
      dto.dropoffZoneId,
      dto.extraZoneIds ?? [],
    );
    return { fee: z.fee };
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ZoneUpdateDto,
  ) {
    return this.zones.update(officeOf(req), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.zones.remove(officeOf(req), id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
