import {
  BadRequestException,
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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthUser, AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';
import { ZonesModule, ZonesService } from '../zones/zones.module';
import type { ZoneSnap } from '../zones/zones.module';

const PHONE = /^\d{8,15}$/;

const PUBLIC_COLS = `id, office_id, customer_id, driver_id, created_by,
  customer_phone, customer_name, order_text, pickup_address, dropoff_address,
  pickup_zone, dropoff_zone, extra_pickups,
  contact_phone, notes, delivery_fee, status, created_at, accepted_at, delivered_at`;

const clean = (v?: string) => (v ?? '').trim();
const blank = (v: string | null | undefined) => !v || v.trim() === '';

function pub<T extends { extra_pickups?: unknown }>(row: T): T {
  const list = Array.isArray(row.extra_pickups)
    ? (row.extra_pickups as { name: string }[]).map((e) => ({ name: e.name }))
    : [];
  return { ...row, extra_pickups: list };
}

interface Check {
  customer_phone: string | null;
  customer_name: string | null;
  order_text: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  delivery_fee: string;
}

function missingFields(o: Check): string[] {
  const m: string[] = [];
  if (blank(o.customer_phone)) m.push('customer_phone');
  if (blank(o.customer_name)) m.push('customer_name');
  if (blank(o.order_text)) m.push('order_text');
  if (blank(o.pickup_address)) m.push('pickup_address');
  if (blank(o.dropoff_address)) m.push('dropoff_address');
  if (!(Number(o.delivery_fee) > 0)) m.push('delivery_fee');
  return m;
}

class CreateOrderDto {
  @IsOptional() @Matches(PHONE, { message: 'customerPhone must be 8-15 digits' })
  customerPhone?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() orderText?: string;
  @IsOptional() @IsString() pickupAddress?: string;
  @IsOptional() @IsString() dropoffAddress?: string;
  @IsOptional() @IsInt() pickupZoneId?: number;
  @IsOptional() @IsInt() dropoffZoneId?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true })
  extraPickupZoneIds?: number[];
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() @Min(0) deliveryFee?: number;
  @IsOptional() @IsInt() driverId?: number;
}

class DriverStatusDto {
  @IsIn(['picked_up', 'delivered']) status!: string;
}

class CompleteDto {
  @IsOptional() @Matches(PHONE, { message: 'customerPhone must be 8-15 digits' })
  customerPhone?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() orderText?: string;
  @IsOptional() @IsString() pickupAddress?: string;
  @IsOptional() @IsString() dropoffAddress?: string;
}

class AdminUpdateOrderDto {
  @IsOptional() @IsInt() driverId?: number;
  @IsOptional() @IsNumber() @Min(0) deliveryFee?: number;
  @IsOptional() @IsBoolean() cancel?: boolean;
  @IsOptional() @Matches(PHONE, { message: 'customerPhone must be 8-15 digits' })
  customerPhone?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() orderText?: string;
  @IsOptional() @IsString() pickupAddress?: string;
  @IsOptional() @IsString() dropoffAddress?: string;
  @IsOptional() @IsInt() pickupZoneId?: number;
  @IsOptional() @IsInt() dropoffZoneId?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true })
  extraPickupZoneIds?: number[];
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private db: DbService,
    private zones: ZonesService,
  ) {}

  private async assertDriver(officeId: number, driverId: number) {
    const rows = await this.db.query(
      `SELECT id FROM users
        WHERE id = $1 AND office_id = $2 AND role = 'driver' AND is_active`,
      [driverId, officeId],
    );
    if (rows.length === 0) {
      throw new BadRequestException('Driver not found in this office');
    }
  }

  async create(user: AuthUser, dto: CreateOrderDto) {
    const officeId = user.officeId as number;
    const off = await this.db.query<{ commission_percent: string }>(
      'SELECT commission_percent FROM offices WHERE id = $1',
      [officeId],
    );
    let driverId: number | null = null;
    let customerId: number | null = null;
    let phone: string | null = dto.customerPhone ?? null;
    let name: string | null = clean(dto.customerName) || null;

    if (user.role === 'customer') {
      const me = await this.db.query<{ full_name: string; phone: string }>(
        'SELECT full_name, phone FROM users WHERE id = $1',
        [user.id],
      );
      customerId = user.id;
      phone = me[0].phone;
      name = me[0].full_name;
    } else {
      if (!phone) throw new BadRequestException('Customer phone required');
      if (user.role === 'driver') {
        driverId = user.id;
      } else if (dto.driverId) {
        await this.assertDriver(officeId, dto.driverId);
        driverId = dto.driverId;
      }
      const reg = await this.db.query<{ id: number }>(
        `SELECT id FROM users
          WHERE office_id = $1 AND role = 'customer' AND phone = $2`,
        [officeId, phone],
      );
      if (reg.length > 0) customerId = reg[0].id;
    }

    const hasP = dto.pickupZoneId !== undefined;
    const hasD = dto.dropoffZoneId !== undefined;
    if (hasP !== hasD) throw new BadRequestException('Both zones required');
    let snap: ZoneSnap | null = null;
    let pickupText = clean(dto.pickupAddress);
    let dropoffText = clean(dto.dropoffAddress);
    if (hasP && hasD) {
      snap = await this.zones.resolve(
        officeId,
        dto.pickupZoneId as number,
        dto.dropoffZoneId as number,
        dto.extraPickupZoneIds ?? [],
      );
      pickupText = snap.pickup.name;
      dropoffText = snap.dropoff.name;
    }

    let fee = 0;
    let calculated: number | null = null;
    let overridden = false;
    if (snap) {
      calculated = snap.fee;
      fee = snap.fee;
      if (
        user.role === 'admin' &&
        dto.deliveryFee !== undefined &&
        dto.deliveryFee !== snap.fee
      ) {
        fee = dto.deliveryFee;
        overridden = true;
      }
    } else if (user.role === 'admin') {
      fee = dto.deliveryFee ?? 0;
    }

    const cols = user.role === 'admin' ? '*' : PUBLIC_COLS;
    const rows = await this.db.query(
      `INSERT INTO orders
         (office_id, customer_id, driver_id, created_by, customer_phone,
          customer_name, order_text, pickup_address, dropoff_address,
          contact_phone, notes, delivery_fee, commission_percent, status,
          pickup_zone, pickup_zone_price, dropoff_zone, dropoff_zone_price,
          extra_pickups, calculated_fee, fee_overridden, accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14::text::order_status,
               $15::text, $16::numeric, $17::text, $18::numeric,
               $19::jsonb, $20::numeric, $21::boolean,
               CASE WHEN $3::int IS NULL THEN NULL ELSE now() END)
       RETURNING ${cols}`,
      [
        officeId,
        customerId,
        driverId,
        user.id,
        phone,
        name,
        clean(dto.orderText) || null,
        pickupText,
        dropoffText,
        clean(dto.contactPhone) || null,
        clean(dto.notes) || null,
        fee,
        off[0].commission_percent,
        driverId ? 'assigned' : 'pending',
        snap?.pickup.name ?? null,
        snap?.pickup.price ?? null,
        snap?.dropoff.name ?? null,
        snap?.dropoff.price ?? null,
        JSON.stringify(snap?.extras ?? []),
        calculated,
        overridden,
      ],
    );
    return user.role === 'admin' ? rows[0] : pub(rows[0]);
  }

  async list(user: AuthUser, status?: string) {
    const officeId = user.officeId as number;
    if (user.role === 'admin') {
      return this.db.query(
        `SELECT * FROM orders
          WHERE office_id = $1 AND ($2::text IS NULL OR status::text = $2::text)
          ORDER BY id DESC LIMIT 200`,
        [officeId, status ?? null],
      );
    }
    if (user.role === 'driver') {
      const rows = await this.db.query(
        `SELECT ${PUBLIC_COLS} FROM orders
          WHERE office_id = $1 AND (status = 'pending' OR driver_id = $2)
          ORDER BY id DESC LIMIT 200`,
        [officeId, user.id],
      );
      return rows.map(pub);
    }
    const rows = await this.db.query(
      `SELECT ${PUBLIC_COLS} FROM orders
        WHERE office_id = $1 AND customer_id = $2
        ORDER BY id DESC LIMIT 200`,
      [officeId, user.id],
    );
    return rows.map(pub);
  }

  async lookupCustomer(user: AuthUser, phone: string) {
    if (!PHONE.test(phone ?? '')) throw new BadRequestException('Invalid phone');
    const officeId = user.officeId as number;
    const orders = await this.db.query<{
      customer_name: string | null;
      order_text: string | null;
      pickup_address: string;
      dropoff_address: string;
      pickup_zone: string | null;
      dropoff_zone: string | null;
      extra_pickups: unknown;
      contact_phone: string | null;
      delivery_fee: string;
      status: string;
    }>(
      `SELECT customer_name, order_text, pickup_address, dropoff_address,
              pickup_zone, dropoff_zone, extra_pickups,
              contact_phone, delivery_fee, status::text AS status
         FROM orders
        WHERE office_id = $1 AND customer_phone = $2
        ORDER BY (status = 'delivered') DESC, COALESCE(delivered_at, created_at) DESC
        LIMIT 1`,
      [officeId, phone],
    );
    const o = orders[0];
    if (o) {
      const last =
        o.status === 'delivered'
          ? {
              order_text: o.order_text,
              pickup_address: o.pickup_address,
              dropoff_address: o.dropoff_address,
              pickup_zone: o.pickup_zone,
              dropoff_zone: o.dropoff_zone,
              extra_pickups: pub({ extra_pickups: o.extra_pickups }).extra_pickups,
              contact_phone: o.contact_phone,
              delivery_fee: o.delivery_fee,
            }
          : null;
      return { found: true, name: o.customer_name, last };
    }
    const users = await this.db.query<{ full_name: string }>(
      `SELECT full_name FROM users
        WHERE office_id = $1 AND role = 'customer' AND phone = $2`,
      [officeId, phone],
    );
    if (users.length > 0) return { found: true, name: users[0].full_name, last: null };
    return { found: false, name: null, last: null };
  }

  async accept(user: AuthUser, id: number) {
    const rows = await this.db.query(
      `UPDATE orders SET driver_id = $1, status = 'assigned', accepted_at = now()
        WHERE id = $2 AND office_id = $3 AND status = 'pending'
          AND driver_id IS NULL
        RETURNING ${PUBLIC_COLS}`,
      [user.id, id, user.officeId],
    );
    if (rows.length === 0) throw new ConflictException('Order not available');
    return pub(rows[0]);
  }

  async setStatus(user: AuthUser, id: number, status: string) {
    if (status === 'delivered') {
      const cur = await this.db.query<Check>(
        `SELECT customer_phone, customer_name, order_text, pickup_address,
                dropoff_address, delivery_fee
           FROM orders WHERE id = $1 AND driver_id = $2`,
        [id, user.id],
      );
      if (cur.length > 0) {
        const missing = missingFields(cur[0]);
        if (missing.length > 0) {
          throw new ConflictException('Order data incomplete: ' + missing.join(','));
        }
      }
    }
    const rows = await this.db.query(
      `UPDATE orders SET
         status = $3::text::order_status,
         delivered_at = CASE WHEN $3::text = 'delivered' THEN now() ELSE delivered_at END
        WHERE id = $1 AND driver_id = $2
          AND status = CASE WHEN $3::text = 'picked_up'
                            THEN 'assigned'::order_status
                            ELSE 'picked_up'::order_status END
        RETURNING ${PUBLIC_COLS}`,
      [id, user.id, status],
    );
    if (rows.length === 0) {
      throw new ConflictException('Order not found or status not allowed');
    }
    return pub(rows[0]);
  }

  async complete(user: AuthUser, id: number, dto: CompleteDto) {
    const rows = await this.db.query(
      `UPDATE orders SET
         customer_phone = CASE WHEN COALESCE(btrim(customer_phone), '') = ''
           THEN COALESCE(NULLIF(btrim($3::text), ''), customer_phone) ELSE customer_phone END,
         customer_name = CASE WHEN COALESCE(btrim(customer_name), '') = ''
           THEN COALESCE(NULLIF(btrim($4::text), ''), customer_name) ELSE customer_name END,
         order_text = CASE WHEN COALESCE(btrim(order_text), '') = ''
           THEN COALESCE(NULLIF(btrim($5::text), ''), order_text) ELSE order_text END,
         pickup_address = CASE WHEN btrim(pickup_address) = ''
           THEN COALESCE(NULLIF(btrim($6::text), ''), pickup_address) ELSE pickup_address END,
         dropoff_address = CASE WHEN btrim(dropoff_address) = ''
           THEN COALESCE(NULLIF(btrim($7::text), ''), dropoff_address) ELSE dropoff_address END
        WHERE id = $1 AND driver_id = $2 AND status IN ('assigned', 'picked_up')
        RETURNING ${PUBLIC_COLS}`,
      [
        id,
        user.id,
        dto.customerPhone ?? null,
        dto.customerName ?? null,
        dto.orderText ?? null,
        dto.pickupAddress ?? null,
        dto.dropoffAddress ?? null,
      ],
    );
    if (rows.length === 0) throw new NotFoundException('Order not found or closed');
    return pub(rows[0]);
  }

  async adminUpdate(user: AuthUser, id: number, dto: AdminUpdateOrderDto) {
    const officeId = user.officeId as number;
    if (dto.driverId) await this.assertDriver(officeId, dto.driverId);
    const hasP = dto.pickupZoneId !== undefined;
    const hasD = dto.dropoffZoneId !== undefined;
    if (hasP !== hasD) throw new BadRequestException('Both zones required');
    let zonesChanged = false;
    let snap: ZoneSnap | null = null;
    let fee: number | null = dto.deliveryFee ?? null;
    let overridden = false;
    if (hasP && hasD) {
      snap = await this.zones.resolve(
        officeId,
        dto.pickupZoneId as number,
        dto.dropoffZoneId as number,
        dto.extraPickupZoneIds ?? [],
      );
      zonesChanged = true;
      fee = snap.fee;
      if (dto.deliveryFee !== undefined && dto.deliveryFee !== snap.fee) {
        fee = dto.deliveryFee;
        overridden = true;
      }
    }
    const rows = await this.db.query(
      `UPDATE orders SET
         driver_id = COALESCE($3::int, driver_id),
         customer_phone = COALESCE($6::text, customer_phone),
         customer_name = COALESCE($7::text, customer_name),
         order_text = COALESCE($8::text, order_text),
         pickup_address = CASE WHEN $13::boolean THEN $14::text
                               ELSE COALESCE($9::text, pickup_address) END,
         dropoff_address = CASE WHEN $13::boolean THEN $16::text
                                ELSE COALESCE($10::text, dropoff_address) END,
         pickup_zone = CASE WHEN $13::boolean THEN $14::text ELSE pickup_zone END,
         pickup_zone_price = CASE WHEN $13::boolean THEN $15::numeric ELSE pickup_zone_price END,
         dropoff_zone = CASE WHEN $13::boolean THEN $16::text ELSE dropoff_zone END,
         dropoff_zone_price = CASE WHEN $13::boolean THEN $17::numeric ELSE dropoff_zone_price END,
         extra_pickups = CASE WHEN $13::boolean THEN $18::jsonb ELSE extra_pickups END,
         calculated_fee = CASE WHEN $13::boolean THEN $19::numeric ELSE calculated_fee END,
         delivery_fee = COALESCE($4::numeric, delivery_fee),
         fee_overridden = CASE
           WHEN $13::boolean THEN $20::boolean
           WHEN $4::numeric IS NULL THEN fee_overridden
           WHEN calculated_fee IS NULL THEN false
           ELSE ($4::numeric <> calculated_fee) END,
         contact_phone = COALESCE($11::text, contact_phone),
         notes = COALESCE($12::text, notes),
         status = CASE
           WHEN $5::boolean THEN 'cancelled'::order_status
           WHEN $3::int IS NOT NULL AND status = 'pending' THEN 'assigned'::order_status
           ELSE status END,
         accepted_at = CASE
           WHEN $3::int IS NOT NULL AND accepted_at IS NULL THEN now()
           ELSE accepted_at END
        WHERE id = $1 AND office_id = $2
          AND status NOT IN ('delivered', 'cancelled')
        RETURNING *`,
      [
        id,
        officeId,
        dto.driverId ?? null,
        fee,
        dto.cancel ?? false,
        dto.customerPhone ?? null,
        dto.customerName ?? null,
        dto.orderText ?? null,
        dto.pickupAddress ?? null,
        dto.dropoffAddress ?? null,
        dto.contactPhone ?? null,
        dto.notes ?? null,
        zonesChanged,
        snap?.pickup.name ?? null,
        snap?.pickup.price ?? null,
        snap?.dropoff.name ?? null,
        snap?.dropoff.price ?? null,
        JSON.stringify(snap?.extras ?? []),
        snap?.fee ?? null,
        overridden,
      ],
    );
    if (rows.length === 0) throw new NotFoundException('Order not found or closed');
    return rows[0];
  }
}

function userOf(req: AuthedRequest): AuthUser {
  if (!req.user || !req.user.officeId) throw new ForbiddenException('No office');
  return req.user;
}

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  @Roles('admin', 'driver', 'customer')
  create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) {
    return this.orders.create(userOf(req), dto);
  }

  @Get()
  @Roles('admin', 'driver', 'customer')
  list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    return this.orders.list(userOf(req), status);
  }

  @Get('customer')
  @Roles('admin', 'driver')
  lookup(@Req() req: AuthedRequest, @Query('phone') phone: string) {
    return this.orders.lookupCustomer(userOf(req), phone);
  }

  @Post(':id/accept')
  @Roles('driver')
  accept(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.orders.accept(userOf(req), id);
  }

  @Post(':id/status')
  @Roles('driver')
  setStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DriverStatusDto,
  ) {
    return this.orders.setStatus(userOf(req), id, dto.status);
  }

  @Patch(':id/complete')
  @Roles('driver')
  complete(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteDto,
  ) {
    return this.orders.complete(userOf(req), id, dto);
  }

  @Patch(':id')
  @Roles('admin')
  adminUpdate(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateOrderDto,
  ) {
    return this.orders.adminUpdate(userOf(req), id, dto);
  }
}

@Module({
  imports: [AuthModule, ZonesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
