import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DbService } from '../db/db.service';

export interface CreateOfficeInput {
  name: string;
  city: string;
  maxDrivers: number;
  days: number;
  adminName: string;
  adminPhone: string;
  adminPassword: string;
}

export interface UpdateOfficeInput {
  name?: string;
  city?: string;
  maxDrivers?: number;
  addDays?: number;
  isActive?: boolean;
}

@Injectable()
export class OfficesService {
  constructor(private db: DbService) {}

  async create(input: CreateOfficeInput) {
    const hash = await bcrypt.hash(input.adminPassword, 10);
    try {
      return await this.db.transaction(async (client) => {
        const office = await client.query(
          `INSERT INTO offices (name, city, max_drivers, subscription_ends_at)
           VALUES ($1, $2, $3, now() + ($4::int * interval '1 day'))
           RETURNING id, name, city, max_drivers, subscription_ends_at`,
          [input.name, input.city, input.maxDrivers, input.days],
        );
        const o = office.rows[0];
        const admin = await client.query(
          `INSERT INTO users (office_id, role, full_name, phone, password_hash)
           VALUES ($1, 'admin', $2, $3, $4)
           RETURNING id, full_name, phone`,
          [o.id, input.adminName, input.adminPhone, hash],
        );
        return { office: o, admin: admin.rows[0] };
      });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('Phone number already used');
      }
      throw e;
    }
  }

  list() {
    return this.db.query(
      `SELECT o.id, o.name, o.city, o.max_drivers, o.is_active,
              o.commission_percent, o.subscription_ends_at,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM (o.subscription_ends_at - now())) / 86400))::int AS days_left,
              (SELECT count(*)::int FROM users u
                WHERE u.office_id = o.id AND u.role = 'driver') AS drivers_count
         FROM offices o ORDER BY o.id`,
    );
  }

  async update(id: number, input: UpdateOfficeInput) {
    const rows = await this.db.query(
      `UPDATE offices SET
         name = COALESCE(NULLIF(btrim($5::text), ''), name),
         city = COALESCE(NULLIF(btrim($6::text), ''), city),
         max_drivers = COALESCE($2::int, max_drivers),
         is_active = COALESCE($3::boolean, is_active),
         subscription_ends_at = CASE
           WHEN $4::int IS NULL THEN subscription_ends_at
           ELSE GREATEST(subscription_ends_at, now()) + ($4::int * interval '1 day')
         END
       WHERE id = $1
       RETURNING id, name, city, max_drivers, is_active, subscription_ends_at`,
      [
        id,
        input.maxDrivers ?? null,
        input.isActive ?? null,
        input.addDays ?? null,
        input.name ?? null,
        input.city ?? null,
      ],
    );
    if (rows.length === 0) throw new NotFoundException('Office not found');
    return rows[0];
  }
}
