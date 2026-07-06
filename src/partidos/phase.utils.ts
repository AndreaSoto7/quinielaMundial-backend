const normalizePhaseText = (value?: string): string =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const parseDate = (value?: Date | string): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const betweenDates = (date: Date, start: string, end: string): boolean => {
  const time = date.getTime();
  return time >= new Date(`${start}T00:00:00`).getTime() &&
    time <= new Date(`${end}T23:59:59.999`).getTime();
};

export function normalizePartidoPhase(value?: string, fechaHora?: Date | string): string {
  const normalized = normalizePhaseText(value);
  const date = parseDate(fechaHora);

  if (
    [
      'fase grupos',
      'fase de grupos',
      'grupos',
      'grupo',
      'group',
      'groups',
      'group stage',
      'first round',
    ].includes(normalized)
  ) {
    return 'fase_grupos';
  }

  if (['1', '2', '3', 'round 1', 'round 2', 'round 3'].includes(normalized)) {
    if (date) {
      if (betweenDates(date, '2026-06-28', '2026-07-03')) return 'dieciseisavos';
      if (betweenDates(date, '2026-07-04', '2026-07-07')) return 'octavos';
      if (betweenDates(date, '2026-07-09', '2026-07-11')) return 'cuartos';
      if (betweenDates(date, '2026-07-14', '2026-07-15')) return 'semifinal';
      if (betweenDates(date, '2026-07-18', '2026-07-18')) return 'tercer_puesto';
      if (betweenDates(date, '2026-07-19', '2026-07-19')) return 'final';
    }
    return 'fase_grupos';
  }

  if (
    [
      'dieciseisavos',
      'dieciseisavos de final',
      'ronda de 32',
      'round of 32',
      'round 32',
      'last 32',
      '32',
    ].includes(normalized)
  ) {
    return 'dieciseisavos';
  }

  if (
    [
      'octavos',
      'octavos de final',
      'ronda de 16',
      'round of 16',
      'round 16',
      'last 16',
      '16',
    ].includes(normalized)
  ) {
    return 'octavos';
  }

  if (
    [
      'cuartos',
      'cuartos de final',
      'quarter final',
      'quarter finals',
      'quarterfinal',
      'quarterfinals',
    ].includes(normalized)
  ) {
    return 'cuartos';
  }

  if (normalized === '8') return 'cuartos';
  if (normalized === '4') return 'semifinal';
  if (normalized === '2') return date && betweenDates(date, '2026-07-14', '2026-07-15')
    ? 'semifinal'
    : 'fase_grupos';

  if (
    [
      'semifinal',
      'semifinales',
      'semi final',
      'semi finals',
      'semifinals',
    ].includes(normalized)
  ) {
    return 'semifinal';
  }

  if (
    [
      'tercer puesto',
      'partido por el tercer puesto',
      'third place',
      'third place play off',
      'third place playoff',
      '3rd place',
      'bronze final',
    ].includes(normalized)
  ) {
    return 'tercer_puesto';
  }

  if (['final', 'grand final'].includes(normalized)) {
    return 'final';
  }

  return value || 'fase_grupos';
}
