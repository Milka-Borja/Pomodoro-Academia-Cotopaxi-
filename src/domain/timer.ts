// Lógica pura del temporizador Pomodoro (spec 001).
// Sin React, sin AsyncStorage y sin Date.now() interno: el reloj se inyecta
// como parámetro nowMs en cada función (principio 3 de la constitución).

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerState {
  /** Estado actual: detenido, corriendo, pausado o finalizado (00:00). */
  status: TimerStatus;
  /** Tiempo inicial de estudio (25 min por defecto, Decisión 9). */
  durationMs: number;
  /** Marca absoluta de fin; solo tiene sentido cuando status es 'running'. */
  endTimestampMs: number | null;
  /** Restante congelado; solo tiene sentido cuando status es 'paused'. */
  pausedRemainingMs: number | null;
}

/** Tiempo de estudio por defecto: 25 minutos (skill pomodoro-rules). */
export const DEFAULT_STUDY_DURATION_MS = 25 * 60 * 1000;

/**
 * Estado inicial: detenido (idle) a tiempo completo, sin cuenta en marcha.
 */
export function createInitialTimerState(
  durationMs: number = DEFAULT_STUDY_DURATION_MS,
): TimerState {
  return {
    status: 'idle',
    durationMs,
    endTimestampMs: null,
    pausedRemainingMs: null,
  };
}

/**
 * Tiempo restante en el instante nowMs. Nunca negativo:
 * - running: por diferencia con la marca absoluta de fin (exacto aunque la
 *   app haya estado en segundo plano sin ningún tick intermedio, RF-5).
 * - paused: el restante congelado, sin importar cuánto tiempo pase.
 * - finished: 0 (clavado, RF-6). idle: el tiempo inicial completo.
 */
export function getRemainingMs(state: TimerState, nowMs: number): number {
  switch (state.status) {
    case 'running':
      // endTimestampMs es null solo en estados invariantes; si acaso lo fuera,
      // el fallback (null → 0) no puede producir un restante negativo.
      return Math.max(0, (state.endTimestampMs ?? 0) - nowMs);
    case 'paused':
      return state.pausedRemainingMs ?? 0;
    case 'finished':
      return 0;
    case 'idle':
      return state.durationMs;
  }
}

/**
 * Formato mm:ss con dos dígitos, redondeando hacia abajo y con mínimo 00:00
 * (nunca muestra números negativos).
 */
export function formatMmSs(remainingMs: number): string {
  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Etiqueta del botón alterno según el estado (RF-11). */
export function getPrimaryButtonLabel(state: TimerState): string {
  switch (state.status) {
    case 'running':
      return 'Pausar';
    case 'paused':
      return 'Reanudar';
    case 'idle':
    case 'finished':
      return 'Iniciar';
  }
}

/**
 * Inicia o reanuda la cuenta (RF-1, RF-4):
 * - paused: continúa desde el restante congelado, no desde el inicio.
 * - idle o finished: comienza una ronda nueva al tiempo inicial (el arranque
 *   automático desde finished lo cubre el RF-7 en T4).
 * - running: no-op, no se reinicia la cuenta.
 */
export function start(state: TimerState, nowMs: number): TimerState {
  switch (state.status) {
    case 'paused':
      return {
        status: 'running',
        durationMs: state.durationMs,
        endTimestampMs: nowMs + getRemainingMs(state, nowMs),
        pausedRemainingMs: null,
      };
    case 'running':
      return state;
    case 'idle':
    case 'finished':
      return {
        status: 'running',
        durationMs: state.durationMs,
        endTimestampMs: nowMs + state.durationMs,
        pausedRemainingMs: null,
      };
  }
}

/**
 * Confirma el reinicio pedido por el usuario (RF-9, RF-12):
 * - contador con tiempo restante (corriendo o pausado): vuelve al tiempo
 *   inicial de estudio DETENIDO, esperando que el usuario pulse «Iniciar».
 * - contador en 00:00: vuelve al tiempo inicial y arranca una nueva ronda
 *   automáticamente.
 */
export function confirmReset(state: TimerState, nowMs: number): TimerState {
  if (getRemainingMs(state, nowMs) === 0) {
    // RF-12: nueva ronda directa, incluso si un running vencido aún no pasó por tick.
    return {
      status: 'running',
      durationMs: state.durationMs,
      endTimestampMs: nowMs + state.durationMs,
      pausedRemainingMs: null,
    };
  }
  return {
    status: 'idle',
    durationMs: state.durationMs,
    endTimestampMs: null,
    pausedRemainingMs: null,
  };
}

/**
 * El usuario canceló la confirmación de reinicio (RF-10): devuelve el mismo
 * estado, identidad incluida. No se pausa ni se congela nada: si la cuenta
 * estaba corriendo, sigue descontando por su marca de fin (RF-8).
 */
export function cancelReset(state: TimerState): TimerState {
  return state;
}

/**
 * Avanza el estado hasta nowMs (RF-6). Solo actúa sobre running:
 * si la marca de fin ya venció, clava el estado en finished (00:00, jamás
 * negativo). En cualquier otro estado devuelve el mismo estado sin cambios.
 * El intervalo de la pantalla lo llama solo para refrescar la vista: el
 * cálculo real del tiempo es siempre por diferencia de timestamps.
 */
export function tick(state: TimerState, nowMs: number): TimerState {
  if (
    state.status === 'running' &&
    state.endTimestampMs !== null &&
    nowMs >= state.endTimestampMs
  ) {
    return {
      status: 'finished',
      durationMs: state.durationMs,
      endTimestampMs: null,
      pausedRemainingMs: null,
    };
  }
  return state;
}

/**
 * Pausa la cuenta congelando el restante exacto del instante nowMs (RF-3):
 * - running con tiempo ya vencido: pasa a finished (pausar en 00:00 no
 *   devuelve restante negativo).
 * - idle, paused o finished: no-op.
 */
export function pause(state: TimerState, nowMs: number): TimerState {
  if (state.status !== 'running') {
    return state;
  }

  // Mismo fallback que getRemainingMs: null (invariante roto) → 0, nunca negativo.
  const remainingMs = Math.max(0, (state.endTimestampMs ?? 0) - nowMs);
  if (remainingMs <= 0) {
    return {
      status: 'finished',
      durationMs: state.durationMs,
      endTimestampMs: null,
      pausedRemainingMs: null,
    };
  }

  return {
    status: 'paused',
    durationMs: state.durationMs,
    endTimestampMs: null,
    pausedRemainingMs: remainingMs,
  };
}
