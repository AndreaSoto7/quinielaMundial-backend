import { normalizePartidoPhase } from './phase.utils';

describe('normalizePartidoPhase', () => {
  it.each([
    ['1', 'fase_grupos'],
    ['Group Stage', 'fase_grupos'],
    ['grupos', 'fase_grupos'],
    ['Dieciseisavos de final', 'dieciseisavos'],
    ['Round of 32', 'dieciseisavos'],
    ['Octavos de final', 'octavos'],
    ['Round of 16', 'octavos'],
    ['Cuartos de final', 'cuartos'],
    ['Quarter-finals', 'cuartos'],
    ['Semifinales', 'semifinal'],
    ['Semi Final', 'semifinal'],
    ['Tercer puesto', 'tercer_puesto'],
    ['Third Place Play-Off', 'tercer_puesto'],
    ['Final', 'final'],
  ])('normaliza %s como %s', (input, expected) => {
    expect(normalizePartidoPhase(input)).toBe(expected);
  });
});
