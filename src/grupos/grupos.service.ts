import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partido, PartidoEstado } from '../partidos/entities/partido.entity';
import { Pronostico } from '../pronosticos/entities/pronostico.entity';
import { User } from '../users/entities/User';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { GrupoMiembro } from './entities/grupo-miembro.entity';
import { Grupo } from './entities/grupo.entity';

@Injectable()
export class GruposService {
  constructor(
    @InjectRepository(Grupo)
    private readonly gruposRepository: Repository<Grupo>,
    @InjectRepository(GrupoMiembro)
    private readonly miembrosRepository: Repository<GrupoMiembro>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Pronostico)
    private readonly pronosticosRepository: Repository<Pronostico>,
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
  ) {}

  async create(usuarioId: number, dto: CreateGrupoDto): Promise<Grupo> {
    const usuario = await this.findUser(usuarioId);
    const grupo = await this.gruposRepository.save(
      this.gruposRepository.create({
        nombre: dto.nombre,
        codigoInvitacion: await this.generateInvitationCode(),
        creador: usuario,
      }),
    );
    await this.miembrosRepository.save(
      this.miembrosRepository.create({ grupo, usuario }),
    );
    return grupo;
  }

  async join(usuarioId: number, codigoInvitacion: string): Promise<GrupoMiembro> {
    const usuario = await this.findUser(usuarioId);
    const grupo = await this.gruposRepository.findOne({
      where: { codigoInvitacion: codigoInvitacion.trim().toUpperCase() },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    const existing = await this.miembrosRepository.findOne({
      where: { grupo: { id: grupo.id }, usuario: { id: usuarioId } },
    });
    if (existing) throw new ConflictException('Ya perteneces a este grupo');
    return this.miembrosRepository.save(
      this.miembrosRepository.create({ grupo, usuario }),
    );
  }

  async findMine(usuarioId: number) {
    return this.miembrosRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: { grupo: { creador: true } },
      order: { unidoEn: 'DESC' },
    });
  }

  async findOne(usuarioId: number, grupoId: number): Promise<Grupo> {
    await this.ensureMember(usuarioId, grupoId);
    const grupo = await this.gruposRepository.findOne({
      where: { id: grupoId },
      relations: { creador: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  async getInvitationCode(usuarioId: number, grupoId: number) {
    const grupo = await this.gruposRepository.findOne({
      where: { id: grupoId },
      relations: { creador: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (grupo.creador.id !== usuarioId) {
      throw new ForbiddenException('Solo el creador puede consultar el codigo');
    }
    return {
      grupoId: grupo.id,
      codigoInvitacion: grupo.codigoInvitacion,
    };
  }

  async getParticipants(usuarioId: number, grupoId: number) {
    await this.ensureMember(usuarioId, grupoId);
    return this.miembrosRepository.find({
      where: { grupo: { id: grupoId } },
      relations: { usuario: true },
      order: { unidoEn: 'ASC' },
    });
  }

  async getStandings(usuarioId: number, grupoId: number) {
    await this.ensureMember(usuarioId, grupoId);
    const miembros = await this.miembrosRepository.find({
      where: { grupo: { id: grupoId } },
      relations: { usuario: true },
    });
    const partidosFinalizados = await this.partidosRepository.find({
      where: { estado: PartidoEstado.FINALIZADO },
    });
    const pronosticos = await this.pronosticosRepository.find({
      where: miembros.map((miembro) => ({
        usuario: { id: miembro.usuario.id },
        grupo: { id: grupoId },
      })),
      relations: { usuario: true, partido: true },
    });
    await this.recalculateAndSave(pronosticos);
    const partidosFinalizadosIds = new Set(
      partidosFinalizados.map((partido) => partido.id),
    );
    return miembros
      .map((miembro) => {
        const delUsuario = pronosticos.filter(
          (pronostico) =>
            pronostico.usuario.id === miembro.usuario.id &&
            partidosFinalizadosIds.has(pronostico.partido.id),
        );
        const puntos = delUsuario.reduce(
          (total, pronostico) => total + pronostico.puntos,
          0,
        );
        return {
          usuarioId: miembro.usuario.id,
          fullName: miembro.usuario.fullName,
          puntos,
          pronosticos: delUsuario.length,
        };
      })
      .sort((a, b) => b.puntos - a.puntos || a.fullName.localeCompare(b.fullName))
      .map((item, index) => ({ posicion: index + 1, ...item }));
  }

  async ensureMember(usuarioId: number, grupoId: number): Promise<void> {
    const member = await this.miembrosRepository.findOne({
      where: { grupo: { id: grupoId }, usuario: { id: usuarioId } },
    });
    if (!member) throw new ForbiddenException('No perteneces a este grupo');
  }

  private async findUser(usuarioId: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id: usuarioId });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async generateInvitationCode(): Promise<string> {
    let code = '';
    do {
      code = Math.random().toString(36).slice(2, 8).toUpperCase();
    } while (await this.gruposRepository.findOneBy({ codigoInvitacion: code }));
    return code;
  }

  private async recalculateAndSave(pronosticos: Pronostico[]): Promise<void> {
    const changed = pronosticos.filter((pronostico) => {
      const puntos = this.calculatePoints(
        pronostico.golesLocal,
        pronostico.golesVisitante,
        pronostico.partido,
      );
      if (pronostico.puntos === puntos) return false;
      pronostico.puntos = puntos;
      return true;
    });
    if (changed.length) {
      await this.pronosticosRepository.save(changed);
    }
  }

  private calculatePoints(
    golesLocal: number,
    golesVisitante: number,
    partido: Partido,
  ): number {
    if (
      partido.estado !== PartidoEstado.FINALIZADO ||
      partido.golesLocal === null ||
      partido.golesVisitante === null
    ) {
      return 0;
    }
    if (
      golesLocal === partido.golesLocal &&
      golesVisitante === partido.golesVisitante
    ) {
      return 3;
    }
    const predictedSign = Math.sign(golesLocal - golesVisitante);
    const realSign = Math.sign(partido.golesLocal - partido.golesVisitante);
    return predictedSign === realSign ? 1 : 0;
  }
}
