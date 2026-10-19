// Lógica pura del ciclo Pomodoro (spec 002): fases de estudio y descanso,
// constantes por defecto y estado inicial del ciclo.
// Compose src/domain/timer.ts sin duplicar su lógica. Sin React, sin
// AsyncStorage y sin Date.now() interno: el reloj se inyecta como nowMs
// (principio 3 de la constitución).

import {
  DEFAULT_STUDY_DURATION_MS,
  cancelReset,
  createInitialTimerState,
  getPrimaryButtonLabel,
  pause,
  start,
  tick,
  type TimerState,
} from './timer';

/** Fases del ciclo Pomodoro (spec 002, RF-1 a RF-3). */
export type Phase = 'study' | 'shortBreak' | 'longBreak';

/**
 * Estado del ciclo: la fase actual, el temporizador delegado en src/domain/
 * timer.ts (idle | running | paused) y el avance del ciclo actual
 * (observable: 0..POMODOROS_PER_CYCLE-1, RF-2 / RF-4).
 */
export interface CycleState {
  /** Fase actual: estudio, descanso corto o descanso largo. */
  phase: Phase;
  /** Temporizador de la fase; nunca 'finished' dentro de un CycleState. */
  timer: TimerState;
  /** Estudios completados del ciclo actual. */
  completedPomodoros: number;
  /**
   * La fase se cumplió con la app cerrada o en segundo plano y se espera una
   * acción explícita del usuario para iniciar la siguiente (RF-6, spec 003).
   * Opcional para que los CycleState literales de 002 sigan compilando; se lee
   * siempre como `=== true` (ausente = false).
   */
  awaitingNextPhase?: boolean;
}

/** Descanso corto por defecto: 5 minutos (skill pomodoro-rules, RF-1). */
export const DEFAULT_SHORT_BREAK_DURATION_MS = 5 * 60 * 1000;

/** Descanso largo por defecto: 15 minutos (skill pomodoro-rules, RF-2). */
export const DEFAULT_LONG_BREAK_DURATION_MS = 15 * 60 * 1000;

/** Estudios que completan un ciclo: 4 (skill pomodoro-rules, RF-2, RF-9). */
export const POMODOROS_PER_CYCLE = 4;

/** Duración por defecto de cada fase del ciclo (RF-11). */
export const PHASE_DURATIONS_MS: Record<Phase, number> = {
  study: DEFAULT_STUDY_DURATION_MS,
  shortBreak: DEFAULT_SHORT_BREAK_DURATION_MS,
  longBreak: DEFAULT_LONG_BREAK_DURATION_MS,
};

/**
 * Config inyectable del ciclo (spec 005, RF-1): duración de cada fase y
 * tamaño del ciclo. Las transiciones aceptan esta config como parámetro
 * opcional; sin argumento se usa DEFAULT_POMODORO_CONFIG y todo se comporta
 * igual que en specs 001–004 (regresión intacta).
 */
export interface PomodoroConfig {
  /** Duración de cada fase en milisegundos. */
  durationsMs: Record<Phase, number>;
  /** Estudios que completan un ciclo (antes fijo en POMODOROS_PER_CYCLE). */
  pomodorosPerCycle: number;
}

/** Config por defecto: las constantes actuales 25/5/15 y 4 pomodoros (RF-9). */
export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  durationsMs: PHASE_DURATIONS_MS,
  pomodorosPerCycle: POMODOROS_PER_CYCLE,
};

/** Etiqueta visible de cada fase, en español (RF-8). */
export const PHASE_LABELS: Record<Phase, string> = {
  study: 'Estudio',
  shortBreak: 'Descanso corto',
  longBreak: 'Descanso largo',
};

/**
 * Duración por defecto de la fase (RF-11).
 */
export function getPhaseDurationMs(phase: Phase): number {
  return PHASE_DURATIONS_MS[phase];
}

/**
 * Estado inicial del ciclo: fase study con el temporizador detenido (idle) a
 * su duración —25:00 por defecto, la del config si se pasa— y el contador de
 * pomodoros en 0 (base de RF-1 y RF-3; spec 005, RF-1).
 */
export function createInitialCycleState(
  config: PomodoroConfig = DEFAULT_POMODORO_CONFIG,
): CycleState {
  return {
    phase: 'study',
    timer: createInitialTimerState(config.durationsMs.study),
    completedPomodoros: 0,
    awaitingNextPhase: false,
  };
}

/**
 * Etiqueta visible de la fase actual, en español (RF-8): «Estudio»,
 * «Descanso corto» o «Descanso largo». La UI solo la pinta.
 */
export function getPhaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase];
}

/**
 * Forma de la fila de puntos de avance (RF-9): arreglo de
 * POMODOROS_PER_CYCLE casilleros, `true` en los ya completados. Devuelve la
 * forma para que la UI solo pinte; el contador observable nunca llega a 4
 * (cero atómico, RF-2). El tamaño de la fila lo decide el config: por defecto
 * 4 casilleros, como hasta ahora (spec 005, RF-1).
 */
export function getPomodorosCompletados(
  completedPomodoros: number,
  pomodorosPerCycle: number = POMODOROS_PER_CYCLE,
): boolean[] {
  return Array.from(
    { length: pomodorosPerCycle },
    (_, index) => index < completedPomodoros,
  );
}

/**
 * Avanza el ciclo hasta nowMs (RF-10: cálculo por timestamps absolutos, exacto
 * sin ticks intermedios). Cuando la fase se cumple EN PRIMER PLANO, unifica el
 * camino con el de spec 003: intenta detectPhaseEndWhileAway antes de delegar
 * en tick y deja awaitingNextPhase = true con la fase INTACTA y el contador +1
 * (si era estudio); YA NO auto-avanza sola (spec 004, RF-6, decisiones 3 y 10).
 * El avance a la siguiente fase solo ocurre por acción explícita del usuario
 * (startNextPhase). Si la fase no terminó, devuelve el mismo estado.
 *
 * Las transiciones de fase (estudio → descanso con contador, 4.º estudio →
 * descanso largo con cero atómico, descanso → estudio con el contador
 * intacto) ya no se aplican aquí: quedan en advanceToNextPhase (transición)
 * y en startNextPhase (avance con arranque de la siguiente).
 */
export function tickCycle(state: CycleState, nowMs: number): CycleState {
  // Guardia RF-6 (spec 003, T2): mientras la fase está «esperando acción»
  // (se cumplió con la app cerrada), NO se avanza sola. El TICK de primer
  // plano solo refrescaría la vista; el avance lo decide el usuario.
  if (state.awaitingNextPhase === true) {
    return state;
  }

  // Fin de fase unificado en primer plano (spec 004, T2; RF-6): mismo camino
  // que al volver de segundo plano. Si la fase se cumplió, se devuelve la
  // espera con la fase intacta, el temporizador sin tocar (su restante se
  // clava en 00:00) y el contador +1 en un estudio (decisión 8).
  const detected = detectPhaseEndWhileAway(state, nowMs);
  if (detected !== state) {
    return detected;
  }

  // Refresco normal del repintado: la detección de arriba ya cubre todo
  // running vencido, así que tick solo devuelve identidad (pausa, idle,
  // cuenta sin vencer); se conserva la delegación por si el temporizador
  // necesita algún clavado (plan, sección 4).
  const timer = tick(state.timer, nowMs);
  return timer === state.timer ? state : { ...state, timer };
}

/**
 * Transición de fase de 002, extraída para reutilizarla en spec 003 (T1).
 * Deja la siguiente fase DETENIDA a su tiempo completo, esperando «Iniciar»:
 * - estudio con contador < ciclo-1 → descanso corto, contador +1.
 * - último estudio → descanso largo con el contador a 0 en la MISMA transición
 *   (cero atómico; el valor del total nunca es observable, RF-2).
 * - descanso (corto o largo) → estudio con el contador intacto.
 * El resultado siempre deja awaitingNextPhase en false (RF-6): esta función
 * solo avanza de fase; el estado «esperando acción» lo decide la detección.
 * El config manda: sin argumento se usan las duraciones y el total por defecto.
 */
export function advanceToNextPhase(
  state: CycleState,
  config: PomodoroConfig = DEFAULT_POMODORO_CONFIG,
): CycleState {
  if (state.phase === 'study') {
    const nuevos = state.completedPomodoros + 1;
    if (nuevos >= config.pomodorosPerCycle) {
      // Último estudio completado: descanso largo listo con el contador ya a 0
      // en la MISMA transición; el valor del total nunca es observable (RF-2).
      return {
        phase: 'longBreak',
        timer: createInitialTimerState(config.durationsMs.longBreak),
        completedPomodoros: 0,
        awaitingNextPhase: false,
      };
    }
    return {
      phase: 'shortBreak',
      timer: createInitialTimerState(config.durationsMs.shortBreak),
      completedPomodoros: nuevos,
      awaitingNextPhase: false,
    };
  }
  // Descanso terminado (corto o largo): siguiente estudio detenido a su
  // duración (25:00 por defecto). El contador NO se toca: el descanso corto
  // conserva el avance y el largo ya quedó con 0 al ponerse listo (RF-3).
  return {
    phase: 'study',
    timer: createInitialTimerState(config.durationsMs.study),
    completedPomodoros: state.completedPomodoros,
    awaitingNextPhase: false,
  };
}

/**
 * Detecta que la fase actual se cumplió mientras la app estaba cerrada o en
 * segundo plano (spec 003, T2). Al volver a primer plano (AppState 'active') o
 * al restaurar la sesión, si el temporizador estaba 'running' y su marca de fin
 * ya venció, marca awaitingNextPhase = true dejando la fase INTACTA y el
 * temporizador sin tocar (su restante ya se clava en 00:00, RF-6); la siguiente
 * fase solo arranca con acción explícita del usuario (decisión 2).
 *
 * - Si la fase era de ESTUDIO, suma el pomodoro al detectarse (decisión 8):
 *   un alumno que estudió los 25 min completos no pierde su avance por haber
 *   tenido la app cerrada. Con el 4.º, el contador llega a 4 y la fila se pinta
 *   llena mientras dure el estado terminado; el cero atómico ocurre al ponerse
 *   en marcha el descanso largo (startNextPhase, T3).
 * - Si ya estaba awaiting, o el temporizador no está 'running' (idle o pausado,
 *   RF-9), o la cuenta aún no venció, devuelve el MISMO estado con identidad.
 *
 * Reloj inyectado como nowMs (principio 3); no llama a Date.now().
 */
export function detectPhaseEndWhileAway(state: CycleState, nowMs: number): CycleState {
  // Ya se detectó: no se vuelve a actuar (evita duplicar el contador, RF-7).
  if (state.awaitingNextPhase === true) {
    return state;
  }
  // Solo un temporizador en marcha puede haberse cumplido lejos. idle y
  // pausado (restante congelado) no avanzan, pase el tiempo que pase (RF-9).
  if (state.timer.status !== 'running') {
    return state;
  }
  // La cuenta aún no venció: mismo estado, sin cambios.
  if (nowMs < (state.timer.endTimestampMs ?? 0)) {
    return state;
  }

  // La fase se cumplió mientras no se estaba mirando: se espera acción (RF-6).
  const completedPomodoros =
    state.phase === 'study' ? state.completedPomodoros + 1 : state.completedPomodoros;

  return {
    ...state,
    completedPomodoros,
    awaitingNextPhase: true,
    // El temporizador queda como estaba: endTimestampMs ya vencido, así que
    // getRemainingMs lo clava en 00:00 (RF-6, principio 6: nunca negativo).
  };
}

/**
 * El usuario pidió iniciar la siguiente fase desde el estado «fase terminada»
 * (spec 003, T3; RF-8, decisión 6). Si awaitingNextPhase está activo, limpia el
 * flag, aplica la transición de 002 (advanceToNextPhase) y ARRANCA la siguiente
 * fase en el instante nowMs: de lo contrario devuelve el MISMO estado, con
 * identidad (no debe pasar nunca si la UI solo ofrece el botón en awaiting).
 */
export function startNextPhase(
  state: CycleState,
  nowMs: number,
  config: PomodoroConfig = DEFAULT_POMODORO_CONFIG,
): CycleState {
  if (state.awaitingNextPhase !== true) {
    return state;
  }

  // El pomodoro de un estudio ya se contó al DETECTAR el fin (decisión 8,
  // detectPhaseEndWhileAway), así que esta transición NO vuelve a sumar:
  // duplicaría el avance del ciclo.
  let next: CycleState;
  if (state.phase === 'study') {
    next =
      state.completedPomodoros >= config.pomodorosPerCycle
        ? // Último estudio ya contado (contador = total): descanso largo con
          // cero atómico.
          {
            phase: 'longBreak',
            timer: createInitialTimerState(config.durationsMs.longBreak),
            completedPomodoros: 0,
            awaitingNextPhase: false,
          }
        : // Estudio ya contado: descanso corto con el contador intacto.
          {
            phase: 'shortBreak',
            timer: createInitialTimerState(config.durationsMs.shortBreak),
            completedPomodoros: state.completedPomodoros,
            awaitingNextPhase: false,
          };
  } else {
    // Descanso terminado: siguiente estudio; el contador NO se toca.
    next = {
      phase: 'study',
      timer: createInitialTimerState(config.durationsMs.study),
      completedPomodoros: state.completedPomodoros,
      awaitingNextPhase: false,
    };
  }

  // La siguiente fase arranca a su tiempo completo desde ahora (RF-8).
  return startCycle(next, nowMs);
}

/**
 * La fase actual está «terminada esperando acción»: se cumplió con la app
 * cerrada o en segundo plano y aún no se inició la siguiente (RF-6, T3).
 */
export function isPhaseEndedAwaiting(state: CycleState): boolean {
  return state.awaitingNextPhase === true;
}

/**
 * Etiqueta del botón principal según el estado del ciclo (spec 003, T3):
 * - awaitingNextPhase → «Iniciar siguiente» (RF-8): el fin de fase espera la
 *   acción explícita del usuario.
 * - en otro caso → la etiqueta normal del temporizador (Iniciar/Pausar/Reanudar).
 */
export function getCyclePrimaryButtonLabel(state: CycleState): string {
  if (state.awaitingNextPhase === true) {
    return 'Iniciar siguiente';
  }
  return getPrimaryButtonLabel(state.timer);
}

/**
 * Inicia o reanuda la fase actual —estudio o descanso— delegando en start()
 * (RF-5): desde idle fija endTimestampMs = ahora + duración de la fase;
 * desde pausado continúa desde el restante congelado. La fase y el contador
 * no se tocan.
 */
export function startCycle(state: CycleState, nowMs: number): CycleState {
  return { ...state, timer: start(state.timer, nowMs) };
}

/**
 * Pausa la fase actual —estudio o descanso— delegando en pause(): congela el
 * restante exacto del instante nowMs (RF-5). La fase y el contador no se tocan.
 */
export function pauseCycle(state: CycleState, nowMs: number): CycleState {
  return { ...state, timer: pause(state.timer, nowMs) };
}

/**
 * Reinicio confirmado de la fase ACTUAL (RF-6, RF-7): vuelve a su tiempo
 * inicial DETENIDA, sin tocar completedPomodoros. No recibe nowMs ni delega
 * en timer.confirmReset: dentro de un ciclo nunca existe el estado finished
 * (el fin de fase deja lista la siguiente de inmediato), por lo que el
 * «arranque automático desde 00:00» de HU-001 (RF-12) no aplica aquí y
 * ninguna ruta puede arrancar sola (Decisión 3).
 */
export function confirmResetCycle(
  state: CycleState,
  config: PomodoroConfig = DEFAULT_POMODORO_CONFIG,
): CycleState {
  return {
    ...state,
    timer: createInitialTimerState(config.durationsMs[state.phase]),
    // Reiniciar es una acción explícita del usuario que RESUELVE el estado
    // «fase terminada» (RF-6, T8): se vuelve a la fase ACTUAL a su tiempo
    // inicial, detenida y fuera de espera, con el botón normal «Iniciar».
    // El avance del ciclo se conserva (pomodoro-rules: progreso intacto).
    awaitingNextPhase: false,
  };
}

/**
 * Aplica la config recién guardada al estado actual (spec 005, RF-1/RF-7):
 * - Fase DETENIDA (idle) → su temporizador toma la nueva duración de esa
 *   fase; si la duración no cambió, devuelve el MISMO estado con identidad
 *   (sin repintado ni escritura extra).
 * - Fase iniciada (corriendo o en pausa) → se devuelve tal cual con
 *   identidad: endTimestampMs o pausedRemainingMs quedan intactos y el
 *   nuevo valor se aplicará desde la próxima fase. El contador de pomodoros
 *   nunca se toca (RF-7: la fila de puntos no cambia al ajustar).
 */
export function applySettingsToCycle(
  state: CycleState,
  config: PomodoroConfig,
): CycleState {
  if (state.timer.status !== 'idle') return state;
  const durationMs = config.durationsMs[state.phase];
  if (state.timer.durationMs === durationMs) return state;
  return {
    ...state,
    timer: createInitialTimerState(durationMs),
  };
}

/**
 * El usuario canceló la confirmación de reinicio (RF-5): delegando en
 * cancelReset(), devuelve exactamente el mismo estado, con identidad, en
 * cualquier fase. La cuenta corrienda sigue descontando por su marca de fin.
 */
export function cancelResetCycle(state: CycleState): CycleState {
  const timer = cancelReset(state.timer);
  return timer === state.timer ? state : { ...state, timer };
}
