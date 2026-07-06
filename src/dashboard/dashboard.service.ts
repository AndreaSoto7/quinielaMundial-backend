import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { GrupoMiembro } from '../grupos/entities/grupo-miembro.entity';
import { Partido, PartidoEstado } from '../partidos/entities/partido.entity';
import { Pronostico } from '../pronosticos/entities/pronostico.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(GrupoMiembro)
    private readonly miembrosRepository: Repository<GrupoMiembro>,
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
    @InjectRepository(Pronostico)
    private readonly pronosticosRepository: Repository<Pronostico>,
  ) {}

  async summary(usuarioId: number) {
    const grupos = await this.miembrosRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: { grupo: true },
    });
    const pronosticos = await this.pronosticosRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: { partido: true, grupo: true },
    });
    const pronosticadosIds = new Set(
      pronosticos.map((pronostico) => pronostico.partido.id),
    );
    const proximosPartidos = await this.partidosRepository.find({
      where: {
        estado: PartidoEstado.PROGRAMADO,
        fechaHora: MoreThan(new Date()),
      },
      order: { fechaHora: 'ASC' },
      take: 10,
    });
    const pendientesPorGrupo = grupos.map((miembro) => {
      const pronosticadosEnGrupo = new Set(
        pronosticos
          .filter((pronostico) => pronostico.grupo?.id === miembro.grupo.id)
          .map((pronostico) => pronostico.partido.id),
      );
      return {
        grupoId: miembro.grupo.id,
        nombre: miembro.grupo.nombre,
        partidos: proximosPartidos.filter(
          (partido) => !pronosticadosEnGrupo.has(partido.id),
        ),
      };
    });
    const posicionesPorGrupo = await Promise.all(
      grupos.map(async (miembro) => {
        const miembrosDelGrupo = await this.miembrosRepository.find({
          where: { grupo: { id: miembro.grupo.id } },
          relations: { usuario: true },
        });
        const tabla = await Promise.all(
          miembrosDelGrupo.map(async (item) => {
            const delUsuario = await this.pronosticosRepository.find({
              where: {
                usuario: { id: item.usuario.id },
                grupo: { id: miembro.grupo.id },
              },
            });
            return {
              usuarioId: item.usuario.id,
              fullName: item.usuario.fullName,
              puntos: delUsuario.reduce(
                (total, pronostico) => total + pronostico.puntos,
                0,
              ),
            };
          }),
        );
        const ordenada = tabla.sort(
          (a, b) => b.puntos - a.puntos || a.fullName.localeCompare(b.fullName),
        );
        const posicion = ordenada.findIndex(
          (item) => item.usuarioId === usuarioId,
        );
        return {
          grupoId: miembro.grupo.id,
          nombre: miembro.grupo.nombre,
          posicion: posicion >= 0 ? posicion + 1 : null,
          puntos: ordenada[posicion]?.puntos ?? 0,
        };
      }),
    );

    return {
      cantidadGrupos: grupos.length,
      puntajeAcumulado: pronosticos.reduce(
        (total, pronostico) => total + pronostico.puntos,
        0,
      ),
      proximosPartidosPendientes: proximosPartidos.filter(
        (partido) => !pronosticadosIds.has(partido.id),
      ),
      proximosPartidosPendientesPorGrupo: pendientesPorGrupo,
      grupos: grupos.map((miembro) => ({
        id: miembro.grupo.id,
        nombre: miembro.grupo.nombre,
      })),
      posicionesPorGrupo,
    };
  }
}
