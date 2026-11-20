import {
  Body,
  Controller,
  ForbiddenException,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard, Roles } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { DbService } from '../db/db.service';
import { computeFee } from '../zones/fee';

const PHONE = /^\d{8,15}$/;
const norm = (s: string) => s.trim().toLowerCase();
const text = (v: unknown) => String(v ?? '').trim();

function digits(v: unknown): string {
  const s = String(v ?? '');
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);
    else if (c >= 0x06f0 && c <= 0x06f9) out += String(c - 0x06f0);
    else out += ch;
  }
  return out;
}

function phoneOf(v: unknown): string {
  let p = digits(v).replace(/\D/g, '');
  if (/^1\d{9}$/.test(p)) p = '0' + p;
  return p;
}

class ImportDto {
  @IsArray() @ArrayMaxSize(500) rows!: unknown[];
  @IsBoolean() commit!: boolean;
}

interface Zone {
  id: number;
  name: string;
  price: number;
}

interface Plan {
  customerId: number | null;
  driverId: number | null;
  phone: string;
  name: string;
  orderText: string;
  pickup: Zone;
  dropoff: Zone;
  extras: Zone[];
  contact: string;
  notes: string;
  fee: number;
  calculated: number;
  overridden: boolean;
}

export interface RowResult {
  row: number;
  ok: boolean;
  error: string | null;
  customerPhone: string;
  customerName: string;
  pickup: string;
  extras: string[];
  dropoff: string;
  fee: number | null;
  driverPhone: string;
}

const KEYS = [
  'customerPhone',
  'customerName',
  'orderText',
  'pickup',
  'extras',
  'dropoff',
  'fee',
  'contactPhone',
  'notes',
  'driverPhone',
];

@Injectable()
export class ImportService {
  constructor(private db: DbService) {}

  async run(officeId: number, userId: number, rows: unknown[], commit: boolean) {
    const zr = await this.db.query<{ id: number; name: string; price: string }>(
      'SELECT id, name, price FROM zones WHERE office_id = $1',
      [officeId],
    );
    const zones = new Map<string, Zone>(
      zr.map((z) => [norm(z.name), { id: z.id, name: z.name, price: Number(z.price) }] as [string, Zone]),
    );
    const dr = await this.db.query<{ id: number; phone: string }>(
      `SELECT id, phone FROM users
        WHERE office_id = $1 AND role = 'driver' AND is_active`,
      [officeId],
    );
    const drivers = new Map<string, number>(dr.map((d) => [d.phone, d.id] as [string, number]));
    const cr = await this.db.query<{ id: number; phone: string }>(
      `SELECT id, phone FROM users WHERE office_id = $1 AND role = 'customer'`,
      [officeId],
    );
    const customers = new Map<string, number>(cr.map((c) => [c.phone, c.id] as [string, number]));
    const off = await this.db.query<{ commission_percent: string }>(
      'SELECT commission_percent FROM offices WHERE id = $1',
      [officeId],
    );
    const commission = off[0].commission_percent;

    const results: RowResult[] = [];
    const plans: Plan[] = [];

    rows.forEach((raw, i) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      if (KEYS.every((k) => text(r[k]) === '')) return;
      const phone = phoneOf(r.customerPhone);
      const extraNames = text(r.extras)
        .split(/[\u060c,;|\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const res: RowResult = {
        row: i + 1,
        ok: false,
        error: null,
        customerPhone: phone,
        customerName: text(r.customerName),
        pickup: text(r.pickup),
        extras: extraNames,
        dropoff: text(r.dropoff),
        fee: null,
        driverPhone: phoneOf(r.driverPhone),
      };
      const fail = (e: string) => {
        res.error = e;
        results.push(res);
      };
      if (!PHONE.test(phone)) return fail('invalid customer phone');
      if (!res.pickup) return fail('pickup required');
      const pz = zones.get(norm(res.pickup));
      if (!pz) return fail('pickup zone not found');
      if (!res.dropoff) return fail('dropoff required');
      const dz = zones.get(norm(res.dropoff));
      if (!dz) return fail('dropoff zone not found');
      const ex: Zone[] = [];
      for (const n of extraNames) {
        const z = zones.get(norm(n));
        if (!z) return fail('extra zone not found: ' + n);
        ex.push(z);
      }
      let manual: number | null = null;
      if (text(r.fee) !== '') {
        const f = Number(digits(r.fee).replace(',', '.'));
        if (!Number.isFinite(f) || f < 0 || f > 100000) return fail('invalid fee');
        manual = f;
      }
      const contact = text(r.contactPhone) === '' ? '' : phoneOf(r.contactPhone);
      if (contact !== '' && !PHONE.test(contact)) return fail('invalid contact phone');
      let driverId: number | null = null;
      if (res.driverPhone !== '') {
        const d = drivers.get(res.driverPhone);
        if (d === undefined) return fail('driver not found');
        driverId = d;
      }
      const calc = computeFee(pz, dz, ex);
      const overridden = manual !== null && manual !== calc;
      const fee = overridden ? (manual as number) : calc;
      res.ok = true;
      res.fee = fee;
      results.push(res);
      plans.push({
        customerId: customers.get(phone) ?? null,
        driverId,
        phone,
        name: res.customerName,
        orderText: text(r.orderText),
        pickup: pz,
        dropoff: dz,
        extras: ex,
        contact,
        notes: text(r.notes),
        fee,
        calculated: calc,
        overridden,
      });
    });

    let created = 0;
    if (commit && plans.length > 0) {
      await this.db.transaction(async (client) => {
        for (const p of plans) {
          await client.query(
            `INSERT INTO orders
               (office_id, customer_id, driver_id, created_by, customer_phone,
                customer_name, order_text, pickup_address, dropoff_address,
                contact_phone, notes, delivery_fee, commission_percent, status,
                pickup_zone, pickup_zone_price, dropoff_zone, dropoff_zone_price,
                extra_pickups, calculated_fee, fee_overridden, accepted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                     $14::text::order_status, $15, $16, $17, $18, $19::jsonb,
                     $20, $21, CASE WHEN $3::int IS NULL THEN NULL ELSE now() END)`,
            [
              officeId,
              p.customerId,
              p.driverId,
              userId,
              p.phone,
              p.name || null,
              p.orderText || null,
              p.pickup.name,
              p.dropoff.name,
              p.contact || null,
              p.notes || null,
              p.fee,
              commission,
              p.driverId ? 'assigned' : 'pending',
              p.pickup.name,
              p.pickup.price,
              p.dropoff.name,
              p.dropoff.price,
              JSON.stringify(p.extras.map((e) => ({ name: e.name, price: e.price }))),
              p.calculated,
              p.overridden,
            ],
          );
          created += 1;
        }
      });
    }
    return {
      total: results.length,
      valid: plans.length,
      invalid: results.length - plans.length,
      created,
      rows: results,
    };
  }
}

@Controller('orders')
@UseGuards(AuthGuard)
@Roles('admin')
export class ImportController {
  constructor(private svc: ImportService) {}

  @Post('import')
  run(@Req() req: AuthedRequest, @Body() dto: ImportDto) {
    const u = req.user;
    if (!u || !u.officeId) throw new ForbiddenException('No office');
    return this.svc.run(u.officeId, u.id, dto.rows, dto.commit);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
