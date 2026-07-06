import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GrupoMiembro } from '../../grupos/entities/grupo-miembro.entity';
import { Grupo } from '../../grupos/entities/grupo.entity';
import { Pronostico } from '../../pronosticos/entities/pronostico.entity';

export enum UserRole {
  VISITANTE = 'visitante',
  USUARIO = 'usuario',
  ADMIN = 'admin',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  fullName: string;
  @Column({ unique: true })
  email: string;
  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USUARIO })
  role: UserRole;

  @OneToMany(() => Grupo, (grupo) => grupo.creador)
  gruposCreados: Grupo[];

  @OneToMany(() => GrupoMiembro, (miembro) => miembro.usuario)
  membresias: GrupoMiembro[];

  @OneToMany(() => Pronostico, (pronostico) => pronostico.usuario)
  pronosticos: Pronostico[];
}
