import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateProfileDto } from '../auth/dto/update-profile-dto';
import { UserInfoDto } from '../auth/dto/userinfo-dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@Req() request: Request) {
    const user = request['user'] as UserInfoDto;
    return user;
  }

  @Patch('me')
  async updateMe(@Req() request: Request, @Body() dto: UpdateProfileDto) {
    const user = request['user'] as UserInfoDto;
    const updated = await this.usersService.updateProfile(user.id, dto);
    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
    };
  }
}
