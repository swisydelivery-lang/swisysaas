import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import { IsInt, IsString, Matches, Min, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { DbService } from '../db/db.service';

class RegisterDto {
  @IsString() @MinLength(2) fullName!: string;
  @Matches(/^\d{8,15}$/, { message: 'phone must be 8-15 digits' })
  phone!: string;
  @IsString() @MinLength(6) password!: string;
  @IsInt() @Min(1) officeId!: number;
}

@Injectable()
export class PublicService {
  constructor(private db: DbService) {}

  offices() {
    return this.db.query(
      `SELECT id, name, city FROM offices
        WHERE is_active AND subscription_ends_at > now()
        ORDER BY city, name`,
    );
  }

  async register(dto: RegisterDto) {
    const offices = await this.db.query(
      `SELECT id FROM offices
        WHERE id = $1 AND is_active AND subscription_ends_at > now()`,
      [dto.officeId],
    );
    if (offices.length === 0) {
      throw new BadRequestException('Office not available');
    }
    const hash = await bcrypt.hash(dto.password, 10);
    try {
      const rows = await this.db.query(
        `INSERT INTO users (office_id, role, full_name, phone, password_hash)
         VALUES ($1, 'customer', $2, $3, $4)
         RETURNING id, full_name, phone, office_id`,
        [dto.officeId, dto.fullName, dto.phone, hash],
      );
      return rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('Phone number already used');
      }
      throw e;
    }
  }
}

@Controller('public')
export class PublicController {
  constructor(private service: PublicService) {}

  @Get('offices')
  offices() {
    return this.service.offices();
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }
}

@Module({
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
