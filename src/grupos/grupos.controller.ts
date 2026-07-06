import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UserInfoDto } from '../auth/dto/userinfo-dto';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { JoinGrupoDto } from './dto/join-grupo.dto';
import { GruposService } from './grupos.service';

@Controller('grupos')
@UseGuards(AuthGuard)
export class GruposController {
  constructor(private readonly service: GruposService) {}

  @Post()
  create(@Req() request: Request, @Body() dto: CreateGrupoDto) {
    const user = request['user'] as UserInfoDto;
    return this.service.create(user.id, dto);
  }

  @Post('unirse')
  join(@Req() request: Request, @Body() dto: JoinGrupoDto) {
    const user = request['user'] as UserInfoDto;
    return this.service.join(user.id, dto.codigoInvitacion);
  }

  @Get()
  findMine(@Req() request: Request) {
    const user = request['user'] as UserInfoDto;
    return this.service.findMine(user.id);
  }

  @Get(':id')
  findOne(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    const user = request['user'] as UserInfoDto;
    return this.service.findOne(user.id, id);
  }

  @Get(':id/codigo')
  code(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    const user = request['user'] as UserInfoDto;
    return this.service.getInvitationCode(user.id, id);
  }

  @Get(':id/invitacion')
  invitation(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    const user = request['user'] as UserInfoDto;
    return this.service.getInvitationCode(user.id, id);
  }

  @Get(':id/participantes')
  participants(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    const user = request['user'] as UserInfoDto;
    return this.service.getParticipants(user.id, id);
  }

  @Get(':id/clasificacion')
  standings(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    const user = request['user'] as UserInfoDto;
    return this.service.getStandings(user.id, id);
  }
}
