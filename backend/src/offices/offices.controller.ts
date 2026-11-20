import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { OfficesService } from './offices.service';

class CreateOfficeDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) city!: string;
  @IsInt() @Min(0) maxDrivers!: number;
  @IsInt() @Min(1) days!: number;
  @IsString() @MinLength(2) adminName!: string;
  @Matches(/^\d{8,15}$/, { message: 'adminPhone must be 8-15 digits' })
  adminPhone!: string;
  @IsString() @MinLength(6) adminPassword!: string;
}

class UpdateOfficeDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(2) city?: string;
  @IsOptional() @IsInt() @Min(0) maxDrivers?: number;
  @IsOptional() @IsInt() @Min(1) addDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('offices')
@UseGuards(AuthGuard)
@Roles('super_admin')
export class OfficesController {
  constructor(private offices: OfficesService) {}

  @Post()
  create(@Body() dto: CreateOfficeDto) {
    return this.offices.create(dto);
  }

  @Get()
  list() {
    return this.offices.list();
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOfficeDto) {
    return this.offices.update(id, dto);
  }
}
