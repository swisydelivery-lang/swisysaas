import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DbService } from '../db/db.service';

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function tooMany(key: string): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return a.count >= MAX_FAILS;
}

function recordFail(key: string) {
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) {
      if (Date.now() - v.first > WINDOW_MS) attempts.delete(k);
    }
  }
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    a.count += 1;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwt: JwtService,
  ) {}

  async login(phone: string, password: string, ip = '') {
    const key = ip + '|' + phone;
    if (tooMany(key)) {
      throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    const rows = await this.db.query<{
      id: number;
      full_name: string;
      role: string;
      office_id: number | null;
      password_hash: string;
      is_active: boolean;
      office_name: string | null;
      office_active: boolean | null;
      subscription_ends_at: Date | null;
    }>(
      `SELECT u.id, u.full_name, u.role, u.office_id, u.password_hash, u.is_active,
              o.name AS office_name, o.is_active AS office_active,
              o.subscription_ends_at
         FROM users u LEFT JOIN offices o ON o.id = u.office_id
        WHERE u.phone = $1`,
      [phone],
    );
    const u = rows[0];
    const ok = u ? await bcrypt.compare(password, u.password_hash) : false;
    if (!u || !ok || !u.is_active) {
      recordFail(key);
      throw new UnauthorizedException('Wrong phone or password');
    }
    attempts.delete(key);

    let office: { name: string | null; daysLeft: number; warning: boolean } | null =
      null;
    if (u.role !== 'super_admin') {
      if (!u.office_active) throw new ForbiddenException('Office is disabled');
      const ends = u.subscription_ends_at;
      if (!ends || ends < new Date()) {
        throw new ForbiddenException('Subscription expired');
      }
      const daysLeft = Math.ceil((ends.getTime() - Date.now()) / 86400000);
      office = { name: u.office_name, daysLeft, warning: daysLeft <= 7 };
    }

    const token = await this.jwt.signAsync({ sub: u.id });
    return {
      token,
      user: {
        id: u.id,
        fullName: u.full_name,
        role: u.role,
        officeId: u.office_id,
      },
      office,
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const rows = await this.db.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
    );
    const ok = rows[0]
      ? await bcrypt.compare(oldPassword, rows[0].password_hash)
      : false;
    if (!ok) throw new BadRequestException('Wrong current password');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [
      userId,
      hash,
    ]);
    return { ok: true };
  }
}
