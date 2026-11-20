import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service';

export type Role = 'super_admin' | 'admin' | 'driver' | 'customer';

export interface AuthUser {
  id: number;
  role: Role;
  officeId: number | null;
}

export interface AuthedRequest {
  headers: Record<string, string | undefined>;
  user?: AuthUser;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private db: DbService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Missing token');

    let userId: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const rows = await this.db.query<{
      id: number;
      role: Role;
      office_id: number | null;
      is_active: boolean;
      office_active: boolean | null;
      subscription_ends_at: Date | null;
    }>(
      `SELECT u.id, u.role, u.office_id, u.is_active,
              o.is_active AS office_active, o.subscription_ends_at
         FROM users u LEFT JOIN offices o ON o.id = u.office_id
        WHERE u.id = $1`,
      [userId],
    );
    const u = rows[0];
    if (!u || !u.is_active) throw new UnauthorizedException('Account disabled');

    if (u.role !== 'super_admin') {
      if (!u.office_active) throw new ForbiddenException('Office is disabled');
      if (!u.subscription_ends_at || u.subscription_ends_at < new Date()) {
        throw new ForbiddenException('Subscription expired');
      }
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles && roles.length > 0 && !roles.includes(u.role)) {
      throw new ForbiddenException('Not allowed');
    }

    req.user = { id: u.id, role: u.role, officeId: u.office_id };
    return true;
  }
}
