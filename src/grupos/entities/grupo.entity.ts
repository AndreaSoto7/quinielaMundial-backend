import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/User';
import { Pronostico } from '../../pronosticos/entities/pronostico.entity';
import { GrupoMiembro } from './grupo-miembro.entity';

@Entity()
export class Grupo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ unique: true })
  codigoInvitacion: string;

  @ManyToOne(() => User, (usuario) => usuario.gruposCreados, {
    nullable: false,
  })
  creador: User;

  @OneToMany(() => GrupoMiembro, (miembro) => miembro.grupo)
  miembros: GrupoMiembro[];

  @OneToMany(() => Pronostico, (pronostico) => pronostico.grupo)
  pronosticos: Pronostico[];

  @CreateDateColumn()
  creadoEn: Date;
}
