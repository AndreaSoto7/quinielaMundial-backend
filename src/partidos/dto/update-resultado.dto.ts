import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PartidoEstado } from '../entities/partido.entity';

export class UpdateResultadoDto {
  @IsInt()
  @Min(0)
  golesLocal: number;

  @IsInt()
  @Min(0)
  golesVisitante: number;

  @IsOptional()
  @IsEnum(PartidoEstado)
  estado?: PartidoEstado;
}
