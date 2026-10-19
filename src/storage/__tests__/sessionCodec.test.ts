import { DEFAULT_STUDY_DURATION_MS, type TimerState } from '../../domain/timer';
import type { CycleState, Phase } from '../../domain/cycle';
import { parseStoredCycleState, serializeCycleState } from '../sessionCodec';

// Reloj fijo inyectado: tests deterministas (plan, sección 7).
const t0 = 1_700_000_000_000;
const MINUTE = 60 * 1000;

function makeState(overrides: Partial<CycleState> = {}): CycleState {
  const timer: TimerState = {
    status: 'running',
    durationMs: DEFAULT_STUDY_DURATION_MS,
    endTimestampMs: t0 + 25 * MINUTE,
    pausedRemainingMs: null,
  };
  return {
    phase: 'study',
    timer,
    completedPomodoros: 2,
    awaitingNextPhase: false,
    ...overrides,
  };
}

describe('sessionCodec — round-trip (RF-2, RF-12)', () => {
  it('serialize → parse devuelve un estado idéntico (running)', () => {
    const state = makeState();
    expect(parseStoredCycleState(serializeCycleState(state))).toEqual(state);
  });

  it('round-trip conserva paused con restante congelado y awaiting', () => {
    const state = makeState({
      phase: 'longBreak',
      timer: {
        status: 'paused',
        durationMs: 15 * MINUTE,
        endTimestampMs: null,
        pausedRemainingMs: 7 * MINUTE + 30_000,
      },
      completedPomodoros: 3,
      awaitingNextPhase: true,
    });
    const parsed = parseStoredCycleState(serializeCycleState(state));
    expect(parsed).toEqual(state);
    expect(parsed?.timer.pausedRemainingMs).toBe(7 * MINUTE + 30_000);
    expect(parsed?.awaitingNextPhase).toBe(true);
  });

  it('round-trip conserva idle y fases distintas', () => {
    for (const phase of ['study', 'shortBreak', 'longBreak'] as Phase[]) {
      const state = makeState({
        phase,
        timer: {
          status: 'idle',
          durationMs: 5 * MINUTE,
          endTimestampMs: null,
          pausedRemainingMs: null,
        },
        completedPomodoros: 0,
      });
      expect(parseStoredCycleState(serializeCycleState(state))).toEqual(state);
    }
  });
});

describe('sessionCodec — validación y fallback a null (RF-2, RF-12)', () => {
  it('null o cadena vacía → null (no hay sesión guardada)', () => {
    expect(parseStoredCycleState(null)).toBeNull();
    expect(parseStoredCycleState('')).toBeNull();
  });

  it('JSON roto (no parseable) → null, sin lanzar excepción', () => {
    expect(parseStoredCycleState('{ esto no es json')).toBeNull();
    expect(parseStoredCycleState('undefined')).toBeNull();
  });

  it('phase inválida → null', () => {
    const raw = serializeCycleState(makeState());
    const bad = JSON.parse(raw);
    bad.phase = 'meditation';
    expect(parseStoredCycleState(JSON.stringify(bad))).toBeNull();
  });

  it('timer.status inválido → null', () => {
    const raw = serializeCycleState(makeState());
    const bad = JSON.parse(raw);
    bad.timer.status = 'exploded';
    expect(parseStoredCycleState(JSON.stringify(bad))).toBeNull();
  });

  it('completedPomodoros negativo o no numérico → null', () => {
    const negativo = JSON.parse(serializeCycleState(makeState()));
    negativo.completedPomodoros = -1;
    expect(parseStoredCycleState(JSON.stringify(negativo))).toBeNull();

    const noNumerico = JSON.parse(serializeCycleState(makeState()));
    noNumerico.completedPomodoros = 'dos';
    expect(parseStoredCycleState(JSON.stringify(noNumerico))).toBeNull();
  });

  it('durationMs negativa o no numérica → null', () => {
    const negativo = JSON.parse(serializeCycleState(makeState()));
    negativo.timer.durationMs = -5;
    expect(parseStoredCycleState(JSON.stringify(negativo))).toBeNull();

    const noNumerico = JSON.parse(serializeCycleState(makeState()));
    noNumerico.timer.durationMs = 'larga';
    expect(parseStoredCycleState(JSON.stringify(noNumerico))).toBeNull();
  });

  it('endTimestampMs y pausedRemainingMs aceptan null o número, y rechazan texto', () => {
    const conNull = makeState({
      timer: { status: 'idle', durationMs: 5 * MINUTE, endTimestampMs: null, pausedRemainingMs: null },
    });
    expect(parseStoredCycleState(serializeCycleState(conNull))).toEqual(conNull);

    const conTexto = JSON.parse(serializeCycleState(makeState()));
    conTexto.timer.endTimestampMs = 'mañana';
    expect(parseStoredCycleState(JSON.stringify(conTexto))).toBeNull();
  });

  it('objeto que no es un estado (faltan campos) → null', () => {
    expect(parseStoredCycleState(JSON.stringify({ phase: 'study' }))).toBeNull();
    expect(parseStoredCycleState('42')).toBeNull();
    expect(parseStoredCycleState('"hola"')).toBeNull();
    expect(parseStoredCycleState('[]')).toBeNull();
  });
});
