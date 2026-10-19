// Codec de la sesión del ciclo (spec 003, T4). Puro: NO importa AsyncStorage
// ni React; solo transforma CycleState ⇄ JSON. La lectura/escritura reales viven
// en cycleStorage.ts, que es el único punto que toca AsyncStorage (principio 3).
//
// Los timestamps son ABSOLUTOS (decisión 1): no se guarda nada relativo al reloj,
// así que el cómputo del restante al reabrir es exacto sin importar cuánto tiempo
// haya pasado con la app cerrada (RF-1, RF-2, RF-12).

import type { CycleState, Phase } from '../domain/cycle';
import type { TimerStatus } from '../domain/timer';

const VALID_PHASES: readonly Phase[] = ['study', 'shortBreak', 'longBreak'];
const VALID_STATUSES: readonly TimerStatus[] = ['idle', 'running', 'paused', 'finished'];

/** Serializa el estado de la sesión a JSON para persistirlo. */
export function serializeCycleState(state: CycleState): string {
  return JSON.stringify(state);
}

/**
 * Parsea y valida la sesión guardada. Devuelve `null` (nunca lanza) ante cualquier
 * dato corrupto, incompleto o fuera de rango, para que la app nunca crashee por un
 * estado guardado: la pantalla cae al estado inicial (RF-2, RF-12).
 */
export function parseStoredCycleState(raw: string | null): CycleState | null {
  if (raw === null || raw === '') {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null; // JSON roto
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const candidate = data as Record<string, unknown>;
  const timer = candidate.timer as Record<string, unknown> | undefined;
  if (typeof timer !== 'object' || timer === null || Array.isArray(timer)) {
    return null;
  }

  if (!isPhase(candidate.phase)) {
    return null;
  }
  if (!isTimerStatus(timer.status)) {
    return null;
  }
  if (!isNonNegativeNumber(candidate.completedPomodoros)) {
    return null;
  }
  if (!isNonNegativeNumber(timer.durationMs)) {
    return null;
  }
  // endTimestampMs y pausedRemainingMs pueden ser null (no aplican) o número ≥ 0.
  if (!isNullOrNonNegativeNumber(timer.endTimestampMs)) {
    return null;
  }
  if (!isNullOrNonNegativeNumber(timer.pausedRemainingMs)) {
    return null;
  }

  // awaitingNextPhase es opcional (ausente = false); se normaliza a booleano.
  const awaitingNextPhase =
    typeof candidate.awaitingNextPhase === 'boolean' ? candidate.awaitingNextPhase : false;

  return {
    phase: candidate.phase as Phase,
    timer: {
      status: timer.status as TimerStatus,
      durationMs: timer.durationMs as number,
      endTimestampMs: timer.endTimestampMs as number | null,
      pausedRemainingMs: timer.pausedRemainingMs as number | null,
    },
    completedPomodoros: candidate.completedPomodoros as number,
    awaitingNextPhase,
  };
}

function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && (VALID_PHASES as readonly string[]).includes(value);
}

function isTimerStatus(value: unknown): value is TimerStatus {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNullOrNonNegativeNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value);
}
