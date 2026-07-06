import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Partido, PartidoEstado } from '../partidos/entities/partido.entity';
import { normalizePartidoPhase } from '../partidos/phase.utils';
import { PronosticosService } from '../pronosticos/pronosticos.service';

interface SportsDbEvent {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strRound?: string;
  intRound?: string;
  strVenue?: string;
  strCity?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  intHomeScore?: string;
  intAwayScore?: string;
  strStatus?: string;
}

@Injectable()
export class SincronizacionService implements OnModuleInit {
  private readonly logger = new Logger(SincronizacionService.name);

  constructor(
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
    private readonly pronosticosService: PronosticosService,
  ) {}

  onModuleInit(): void {
    const enabled = process.env.SPORTSDB_SYNC_ENABLED === 'true';
    if (!enabled) return;
    void this.syncSeasonMatches();
    void this.syncTodayResults();
    setInterval(
      () => void this.syncTodayResults(),
      Number(process.env.SPORTSDB_SYNC_INTERVAL_MS || 20 * 60 * 1000),
    );
  }

  async syncSeasonMatches() {
    const events = await this.fetchSeasonEvents();
    let created = 0;
    let updated = 0;
    let savedCount = 0;
    let resultsUpdated = 0;
    let finalized = 0;
    for (const event of events) {
      if (!event.idEvent) continue;
      const fechaHora = this.resolveEventDate(event);
      if (!fechaHora) continue;
      const golesLocal = this.parseScore(event.intHomeScore);
      const golesVisitante = this.parseScore(event.intAwayScore);
      const current = await this.partidosRepository.findOneBy({
        sportsDbEventId: event.idEvent,
      });
      const partido = current ?? this.partidosRepository.create();
      partido.sportsDbEventId = event.idEvent;
      partido.equipoLocal = event.strHomeTeam || 'Por definir';
      partido.equipoVisitante = event.strAwayTeam || 'Por definir';
      partido.fase = this.mapPhase(event.strRound, event.intRound, fechaHora);
      partido.estadio = event.strVenue || 'Por definir';
      partido.ciudad = event.strCity || 'Por definir';
      partido.fechaHora = fechaHora;
      partido.golesLocal = golesLocal;
      partido.golesVisitante = golesVisitante;
      partido.estado = this.mapStatus(
        event.strStatus,
        fechaHora,
        golesLocal,
        golesVisitante,
      );
      const saved = await this.partidosRepository.save(partido);
      savedCount += 1;
      if (saved.estado === PartidoEstado.FINALIZADO) {
        await this.pronosticosService.recalculateForMatch(saved.id);
        resultsUpdated += 1;
        finalized += 1;
      }
      if (current) updated += 1;
      else created += 1;
    }
    const totalInDatabase = await this.partidosRepository.count();
    this.logger.log(
      `Partidos recibidos desde TheSportsDB: ${events.length}. Partidos guardados: ${savedCount}. Partidos creados: ${created}. Partidos actualizados: ${updated}. Partidos finalizados: ${finalized}. Resultados actualizados: ${resultsUpdated}. Total en base de datos: ${totalInDatabase}.`,
    );
    return {
      created,
      updated,
      saved: savedCount,
      finalized,
      resultsUpdated,
      totalFromApi: events.length,
      totalInDatabase,
    };
  }

  async syncTodayResults() {
    const apiKey = process.env.SPORTSDB_API_KEY || '123';
    const leagueId = process.env.SPORTSDB_WORLD_CUP_LEAGUE_ID || '4429';
    const season = process.env.SPORTSDB_WORLD_CUP_SEASON || '2026';
    const today = new Date().toISOString().slice(0, 10);
    const url =
      process.env.SPORTSDB_EVENTS_DAY_URL ||
      `https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventsday.php?d=${today}&s=Soccer`;
    const finalUrl = url
      .replace('{API_KEY}', apiKey)
      .replace('{LEAGUE_ID}', leagueId)
      .replace('{SEASON}', season);
    this.logger.log(`Consultando TheSportsDB: ${finalUrl}`);
    const response = await fetch(finalUrl);
    if (!response.ok) {
      const message = `Error de API TheSportsDB: ${response.status}`;
      this.logger.error(message);
      throw new Error(message);
    }
    const payload = (await response.json()) as { events?: SportsDbEvent[] };
    const events = payload.events ?? [];
    this.logger.log(`Eventos recibidos desde TheSportsDB: ${events.length}`);
    if (events.length === 0) {
      this.logger.warn('TheSportsDB devolvio una lista vacia para resultados del dia');
    }
    const todayMatches = await this.findTodayMatches();
    let updated = 0;
    let finalized = 0;
    for (const match of todayMatches) {
      if (!match.sportsDbEventId) continue;
      const event = events.find((item) => item.idEvent === match.sportsDbEventId);
      if (!event || event.intHomeScore === null || event.intAwayScore === null) {
        continue;
      }
      const golesLocal = Number(event.intHomeScore);
      const golesVisitante = Number(event.intAwayScore);
      if (Number.isNaN(golesLocal) || Number.isNaN(golesVisitante)) continue;
      match.golesLocal = golesLocal;
      match.golesVisitante = golesVisitante;
      match.estado = this.mapStatus(
        event.strStatus,
        match.fechaHora,
        golesLocal,
        golesVisitante,
      );
      await this.partidosRepository.save(match);
      await this.pronosticosService.recalculateForMatch(match.id);
      if (match.estado === PartidoEstado.FINALIZADO) finalized += 1;
      updated += 1;
    }
    const totalInDatabase = await this.partidosRepository.count();
    this.logger.log(
      `Partidos recibidos desde TheSportsDB: ${events.length}. Partidos actualizados: ${updated}. Partidos finalizados: ${finalized}. Total en base de datos: ${totalInDatabase}.`,
    );
    return { updated, finalized, totalFromApi: events.length, totalInDatabase };
  }

  private async fetchSeasonEvents(): Promise<SportsDbEvent[]> {
    const apiKey = process.env.SPORTSDB_API_KEY || '123';
    const leagueId = process.env.SPORTSDB_WORLD_CUP_LEAGUE_ID || '4429';
    const season = process.env.SPORTSDB_WORLD_CUP_SEASON || '2026';
    const configuredUrl = process.env.SPORTSDB_EVENTS_SEASON_URL;
    const url =
      configuredUrl ||
      `https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventsseason.php?id={LEAGUE_ID}&s={SEASON}`;
    const finalUrl = url
      .replace('{API_KEY}', apiKey)
      .replace('{LEAGUE_ID}', leagueId)
      .replace('{SEASON}', season);
    this.logger.log(`Consultando TheSportsDB: ${finalUrl}`);
    const events = await this.fetchEventsFromUrl(finalUrl);
    const roundEvents = await this.fetchRoundEvents(apiKey, leagueId, season);
    const byId = new Map<string, SportsDbEvent>();
    for (const event of [...events, ...roundEvents]) {
      if (event.idEvent) byId.set(event.idEvent, event);
    }
    const mergedEvents = [...byId.values()];
    this.logger.log(
      `Eventos recibidos desde TheSportsDB: temporada=${events.length}, rondas=${roundEvents.length}, unicos=${mergedEvents.length}`,
    );
    if (mergedEvents.length === 0) {
      this.logger.warn('TheSportsDB devolvio una lista vacia para la temporada');
    }
    return mergedEvents;
  }

  private async fetchRoundEvents(
    apiKey: string,
    leagueId: string,
    season: string,
  ): Promise<SportsDbEvent[]> {
    const rounds = ['1', '2', '3', '32', '16', '8', '4'];
    const events: SportsDbEvent[] = [];
    for (const round of rounds) {
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsround.php?id=${leagueId}&r=${round}&s=${season}`;
      this.logger.log(`Consultando TheSportsDB: ${url}`);
      const roundEvents = await this.fetchEventsFromUrl(url);
      this.logger.log(`Eventos recibidos para ronda ${round}: ${roundEvents.length}`);
      events.push(...roundEvents);
    }
    return events;
  }

  private async fetchEventsFromUrl(url: string): Promise<SportsDbEvent[]> {
    const response = await fetch(url);
    if (!response.ok) {
      const message = `Error de API TheSportsDB: ${response.status}`;
      this.logger.error(message);
      throw new Error(message);
    }
    const payload = (await response.json()) as { events?: SportsDbEvent[] | null };
    return (payload.events ?? []).filter(Boolean);
  }

  private resolveEventDate(event: SportsDbEvent): Date | null {
    if (event.strTimestamp) return new Date(event.strTimestamp);
    if (!event.dateEvent) return null;
    const time = event.strTime || '00:00:00';
    return new Date(`${event.dateEvent}T${time.replace(' ', '')}`);
  }

  private parseScore(value?: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const score = Number(value);
    return Number.isNaN(score) ? null : score;
  }

  private findTodayMatches(): Promise<Partido[]> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return this.partidosRepository.find({
      where: { fechaHora: Between(start, end) },
    });
  }

  private mapStatus(
    status: string | undefined,
    fechaHora: Date,
    golesLocal: number | null,
    golesVisitante: number | null,
  ): PartidoEstado {
    const normalized = status?.trim().toLowerCase() ?? '';
    if (
      ['ft', 'finished', 'final'].includes(normalized) ||
      normalized.includes('match finished')
    ) {
      return PartidoEstado.FINALIZADO;
    }
    if (
      ['live', 'in progress', '1h', '2h', 'ht', 'halftime'].includes(normalized) ||
      normalized.includes('in progress')
    ) {
      return PartidoEstado.EN_VIVO;
    }
    if (
      ['ns', 'not started', 'scheduled'].includes(normalized) ||
      normalized.includes('not started') ||
      normalized.includes('scheduled')
    ) {
      return PartidoEstado.PROGRAMADO;
    }
    const hasScore = golesLocal !== null && golesVisitante !== null;
    if (hasScore && fechaHora.getTime() <= Date.now()) return PartidoEstado.FINALIZADO;
    if (!hasScore && fechaHora.getTime() > Date.now()) return PartidoEstado.PROGRAMADO;
    return PartidoEstado.PROGRAMADO;
  }

  private mapPhase(round?: string, roundNumber?: string, fechaHora?: Date): string {
    return normalizePartidoPhase(round || roundNumber, fechaHora);
  }
}
