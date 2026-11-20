import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';
import { AuthGuard } from './auth.guard';
import type { AuthedRequest } from './auth.guard';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  @Matches(/^\d{8,15}$/, { message: 'phone must be 8-15 digits' })
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Req() req: { ip?: string }, @Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.password, req.ip ?? '');
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      (req.user as { id: number }).id,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
