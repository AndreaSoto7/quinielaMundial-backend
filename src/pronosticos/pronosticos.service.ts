import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrupoMiembro } from '../grupos/entities/grupo-miembro.entity';
import { Grupo } from '../grupos/entities/grupo.entity';
import { Partido, PartidoEstado } from '../partidos/entities/partido.entity';
import { User } from '../users/entities/User';
import { CreatePronosticoDto } from './dto/create-pronostico.dto';
import { UpdatePronosticoDto } from './dto/update-pronostico.dto';
import { Pronostico } from './entities/pronostico.entity';

@Injectable()
export class PronosticosService {
  constructor(
    @InjectRepository(Pronostico)
    private readonly pronosticosRepository: Repository<Pronostico>,
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(GrupoMiembro)
    private readonly miembrosRepository: Repository<GrupoMiembro>,
    @InjectRepository(Grupo)
    private readonly gruposRepository: Repository<Grupo>,
  ) {}

  async create(
    usuarioId: number,
    dto: CreatePronosticoDto,
  ): Promise<Pronostico> {
    const usuario = await this.findUser(usuarioId);
    const grupo = await this.findUserGroup(usuarioId, dto.grupoId);
    const partido = await this.findOpenMatch(dto.partidoId);
    const existing = await this.pronosticosRepository.findOne({
      where: {
        usuario: { id: usuarioId },
        grupo: { id: dto.grupoId },
        partido: { id: dto.partidoId },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Ya registraste un pronostico para este partido en este grupo',
      );
    }
    return this.pronosticosRepository.save(
      this.pronosticosRepository.create({
        usuario,
        grupo,
        partido,
        golesLocal: dto.golesLocal,
        golesVisitante: dto.golesVisitante,
        puntos: this.calculatePoints(dto.golesLocal, dto.golesVisitante, partido),
      }),
    );
  }

  async update(
    usuarioId: number,
    id: number,
    dto: UpdatePronosticoDto,
  ): Promise<Pronostico> {
    const pronostico = await this.pronosticosRepository.findOne({
      where: { id },
      relations: { usuario: true, partido: true, grupo: true },
    });
    if (!pronostico) throw new NotFoundException('Pronostico no encontrado');
    if (pronostico.usuario.id !== usuarioId) {
      throw new ForbiddenException('No puedes modificar este pronostico');
    }
    this.ensureMatchCanBePredicted(pronostico.partido);
    pronostico.golesLocal = dto.golesLocal;
    pronostico.golesVisitante = dto.golesVisitante;
    pronostico.puntos = this.calculatePoints(
      dto.golesLocal,
      dto.golesVisitante,
      pronostico.partido,
    );
    return this.pronosticosRepository.save(pronostico);
  }

  async findMine(usuarioId: number): Promise<Pronostico[]> {
    await this.recalculateForUser(usuarioId);
    return this.pronosticosRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: { partido: true, grupo: true },
      order: { partido: { fechaHora: 'ASC' } },
    });
  }

  async findByGroup(usuarioId: number, grupoId: number): Promise<Pronostico[]> {
    await this.findUserGroup(usuarioId, grupoId);
    await this.recalculateForGroup(grupoId);
    return this.pronosticosRepository.find({
      where: { grupo: { id: grupoId } },
      relations: { usuario: true, partido: true, grupo: true },
      order: { partido: { fechaHora: 'ASC' } },
    });
  }

  async getUserPosition(usuarioId: number, grupoId: number) {
    await this.recalculateForGroup(grupoId);
    const miembros = await this.miembrosRepository.find({
      where: { grupo: { id: grupoId } },
      relations: { usuario: true },
    });
    if (!miembros.some((miembro) => miembro.usuario.id === usuarioId)) {
      throw new ForbiddenException('No perteneces a este grupo');
    }
    const standings = await Promise.all(
      miembros.map(async (miembro) => {
        const pronosticos = await this.pronosticosRepository.find({
          where: {
            usuario: { id: miembro.usuario.id },
            grupo: { id: grupoId },
          },
        });
        return {
          usuarioId: miembro.usuario.id,
          puntos: pronosticos.reduce((total, item) => total + item.puntos, 0),
        };
      }),
    );
    const ordered = standings.sort((a, b) => b.puntos - a.puntos);
    return ordered.find((item, index) => {
      item['posicion'] = index + 1;
      return item.usuarioId === usuarioId;
    });
  }

  async recalculateForMatch(partidoId: number): Promise<void> {
    const pronosticos = await this.pronosticosRepository.find({
      where: { partido: { id: partidoId } },
      relations: { partido: true },
    });
    await this.recalculateAndSave(pronosticos);
  }

  calculatePoints(
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
    const exact =
      golesLocal === partido.golesLocal && golesVisitante === partido.golesVisitante;
    if (exact) return 3;
    const predictedSign = Math.sign(golesLocal - golesVisitante);
    const realSign = Math.sign(partido.golesLocal - partido.golesVisitante);
    return predictedSign === realSign ? 1 : 0;
  }

  private async findUser(usuarioId: number): Promise<User> {
    const usuario = await this.usersRepository.findOneBy({ id: usuarioId });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  private async recalculateForUser(usuarioId: number): Promise<void> {
    const pronosticos = await this.pronosticosRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: { partido: true },
    });
    await this.recalculateAndSave(pronosticos);
  }

  private async recalculateForGroup(grupoId: number): Promise<void> {
    const pronosticos = await this.pronosticosRepository.find({
      where: { grupo: { id: grupoId } },
      relations: { partido: true },
    });
    await this.recalculateAndSave(pronosticos);
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

  private async findOpenMatch(partidoId: number): Promise<Partido> {
    const partido = await this.partidosRepository.findOneBy({ id: partidoId });
    if (!partido) throw new NotFoundException('Partido no encontrado');
    this.ensureMatchCanBePredicted(partido);
    return partido;
  }

  private async findUserGroup(usuarioId: number, grupoId: number): Promise<Grupo> {
    const grupo = await this.gruposRepository.findOneBy({ id: grupoId });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    const member = await this.miembrosRepository.findOne({
      where: { grupo: { id: grupoId }, usuario: { id: usuarioId } },
    });
    if (!member) throw new ForbiddenException('No perteneces a este grupo');
    return grupo;
  }

  private ensureMatchCanBePredicted(partido: Partido): void {
    if (
      partido.estado !== PartidoEstado.PROGRAMADO ||
      new Date(partido.fechaHora) <= new Date()
    ) {
      throw new BadRequestException(
        'Solo se puede pronosticar antes del inicio del partido',
      );
    }
  }
}
