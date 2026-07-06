import { IsInt, Min } from 'class-validator';

export class CreatePronosticoDto {
  @IsInt()
  grupoId: number;

  @IsInt()
  partidoId: number;

  @IsInt()
  @Min(0)
  golesLocal: number;

  @IsInt()
  @Min(0)
  golesVisitante: number;
}
