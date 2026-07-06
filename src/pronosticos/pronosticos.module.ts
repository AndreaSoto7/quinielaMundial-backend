import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { GrupoMiembro } from '../grupos/entities/grupo-miembro.entity';
import { Grupo } from '../grupos/entities/grupo.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { User } from '../users/entities/User';
import { Pronostico } from './entities/pronostico.entity';
import { PronosticosController } from './pronosticos.controller';
import { PronosticosService } from './pronosticos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pronostico, Partido, User, GrupoMiembro, Grupo]),
    AuthModule,
  ],
  controllers: [PronosticosController],
  providers: [PronosticosService],
  exports: [PronosticosService, TypeOrmModule],
})
export class PronosticosModule {}
