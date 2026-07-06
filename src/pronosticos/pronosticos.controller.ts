import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UserInfoDto } from '../auth/dto/userinfo-dto';
import { CreatePronosticoDto } from './dto/create-pronostico.dto';
import { UpdatePronosticoDto } from './dto/update-pronostico.dto';
import { PronosticosService } from './pronosticos.service';

@Controller('pronosticos')
@UseGuards(AuthGuard)
export class PronosticosController {
  constructor(private readonly service: PronosticosService) {}

  @Post()
  create(@Req() request: Request, @Body() dto: CreatePronosticoDto) {
    const user = request['user'] as UserInfoDto;
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePronosticoDto,
  ) {
    const user = request['user'] as UserInfoDto;
    return this.service.update(user.id, id, dto);
  }

  @Get('mios')
  findMine(@Req() request: Request) {
    const user = request['user'] as UserInfoDto;
    return this.service.findMine(user.id);
  }

  @Get('mis-pronosticos')
  findMyPredictions(@Req() request: Request) {
    const user = request['user'] as UserInfoDto;
    return this.service.findMine(user.id);
  }

  @Get('grupo/:grupoId')
  findByGroup(
    @Req() request: Request,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    const user = request['user'] as UserInfoDto;
    return this.service.findByGroup(user.id, grupoId);
  }

  @Get('grupo/:grupoId/posicion')
  position(
    @Req() request: Request,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    const user = request['user'] as UserInfoDto;
    return this.service.getUserPosition(user.id, grupoId);
  }

  @Get('posicion/:grupoId')
  legacyPosition(
    @Req() request: Request,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    const user = request['user'] as UserInfoDto;
    return this.service.getUserPosition(user.id, grupoId);
  }
}
