import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Grupo } from '../../grupos/entities/grupo.entity';
import { Partido } from '../../partidos/entities/partido.entity';
import { User } from '../../users/entities/User';

@Entity()
@Unique(['usuario', 'grupo', 'partido'])
export class Pronostico {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (usuario) => usuario.pronosticos, {
    nullable: false,
  })
  usuario: User;

  @ManyToOne(() => Partido, (partido) => partido.pronosticos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  partido: Partido;

  @ManyToOne(() => Grupo, (grupo) => grupo.pronosticos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  grupo: Grupo;

  @Column({ type: 'int' })
  golesLocal: number;

  @Column({ type: 'int' })
  golesVisitante: number;

  @Column({ type: 'int', default: 0 })
  puntos: number;
}
