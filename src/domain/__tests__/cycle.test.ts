import {
  DEFAULT_LONG_BREAK_DURATION_MS,
  DEFAULT_SHORT_BREAK_DURATION_MS,
  PHASE_DURATIONS_MS,
  PHASE_LABELS,
  POMODOROS_PER_CYCLE,
  advanceToNextPhase,
  applySettingsToCycle,
  createInitialCycleState,
  getPhaseDurationMs,
  getPhaseLabel,
  getPomodorosCompletados,
  cancelResetCycle,
  confirmResetCycle,
  DEFAULT_POMODORO_CONFIG,
  detectPhaseEndWhileAway,
  getCyclePrimaryButtonLabel,
  isPhaseEndedAwaiting,
  pauseCycle,
  startCycle,
  startNextPhase,
  tickCycle,
  type CycleState,
  type Phase,
  type PomodoroConfig,
} from '../cycle';
import {
  DEFAULT_STUDY_DURATION_MS,
  createInitialTimerState,
  formatMmSs,
  getRemainingMs,
} from '../timer';

// Reloj fijo inyectado: sin fake timers, tests deterministas (plan, sección 7).
const t0 = 1_700_000_000_000;
const MINUTE = 60 * 1000;

describe('constantes del ciclo', () => {
  it('descanso corto = 5 min (RF-1, RF-11)', () => {
    expect(DEFAULT_SHORT_BREAK_DURATION_MS).toBe(5 * MINUTE);
  });

  it('descanso largo = 15 min (RF-2, RF-11)', () => {
    expect(DEFAULT_LONG_BREAK_DURATION_MS).toBe(15 * MINUTE);
  });

  it('POMODOROS_PER_CYCLE = 4 (RF-2, RF-9, RF-11)', () => {
    expect(POMODOROS_PER_CYCLE).toBe(4);
  });

  it('PHASE_DURATIONS_MS da 5 min corto y 15 min largo (RF-11)', () => {
    expect(PHASE_DURATIONS_MS.shortBreak).toBe(5 * MINUTE);
    expect(PHASE_DURATIONS_MS.longBreak).toBe(15 * MINUTE);
  });

  it('PHASE_LABELS usa textos en español (RF-8)', () => {
    const phases: Phase[] = ['study', 'shortBreak', 'longBreak'];
    for (const phase of phases) {
      expect(typeof PHASE_LABELS[phase]).toBe('string');
      expect(PHASE_LABELS[phase]).toMatch(/[A-ZÁÉÍÓÚÑáéíóúña-záéíóúñ]/);
    }
  });
});

describe('getPhaseDurationMs', () => {
  it('devuelve la duración por defecto de cada fase (RF-11)', () => {
    expect(getPhaseDurationMs('study')).toBe(25 * MINUTE);
    expect(getPhaseDurationMs('shortBreak')).toBe(5 * MINUTE);
    expect(getPhaseDurationMs('longBreak')).toBe(15 * MINUTE);
  });
});

describe('createInitialCycleState', () => {
  it('arranca en fase study con el temporizador idle a 25:00 detenido, contador en 0 y sin esperar acción (base RF-1, RF-3, RF-6)', () => {
    const state = createInitialCycleState();

    expect(state.phase).toBe('study');
    expect(state.timer.status).toBe('idle');
    expect(state.timer.durationMs).toBe(25 * MINUTE);
    expect(state.timer.endTimestampMs).toBeNull();
    expect(state.timer.pausedRemainingMs).toBeNull();
    expect(state.completedPomodoros).toBe(0);
    expect(state.awaitingNextPhase).toBe(false);
  });
});

describe('getPhaseLabel (RF-8)', () => {
  it('devuelve la etiqueta en español de cada fase', () => {
    expect(getPhaseLabel('study')).toBe('Estudio');
    expect(getPhaseLabel('shortBreak')).toBe('Descanso corto');
    expect(getPhaseLabel('longBreak')).toBe('Descanso largo');
  });
});

describe('getPomodorosCompletados (RF-9)', () => {
  it('con 0 completados devuelve los 4 casilleros vacíos', () => {
    expect(getPomodorosCompletados(0)).toEqual([false, false, false, false]);
    expect(getPomodorosCompletados(0)).toHaveLength(POMODOROS_PER_CYCLE);
  });

  it('marca como completados los primeros casilleros según el contador', () => {
    expect(getPomodorosCompletados(1)).toEqual([true, false, false, false]);
    expect(getPomodorosCompletados(2)).toEqual([true, true, false, false]);
    expect(getPomodorosCompletados(3)).toEqual([true, true, true, false]);
  });
});

// Ciclo construido a mano: startCycle llega en T5 (patrón de timer.test.ts).
function studyRunning(completedPomodoros: number, startMs: number): CycleState {
  return {
    phase: 'study',
    timer: {
      status: 'running',
      durationMs: DEFAULT_STUDY_DURATION_MS,
      endTimestampMs: startMs + 25 * MINUTE,
      pausedRemainingMs: null,
    },
    completedPomodoros,
  };
}

describe('tickCycle — fin de fase en primer plano: espera, sin auto-avance (RF-6, RF-9)', () => {
  it('el estudio que llega a 00:00 en primer plano deja awaitingNextPhase con la fase intacta y el contador +1 (RF-6, RF-9)', () => {
    const state = studyRunning(0, t0);

    const next = tickCycle(state, t0 + 25 * MINUTE);

    // Regresión deliberada de 002 (plan 004, decisión 1): YA NO auto-avanza al
    // descanso; la fase cumplida espera la acción explícita del usuario.
    expect(next.awaitingNextPhase).toBe(true);
    expect(next.phase).toBe('study');
    expect(next.completedPomodoros).toBe(1);
    expect(getRemainingMs(next.timer, t0 + 25 * MINUTE)).toBe(0);
    expect(formatMmSs(getRemainingMs(next.timer, t0 + 25 * MINUTE))).toBe('00:00');
    expect(getCyclePrimaryButtonLabel(next)).toBe('Iniciar siguiente');
  });

  it('sube el contador de a uno (1→2 y 2→3) sin salir del estudio ni de la espera (RF-6)', () => {
    const con1 = tickCycle(studyRunning(1, t0), t0 + 25 * MINUTE);
    const con2 = tickCycle(studyRunning(2, t0), t0 + 25 * MINUTE);

    expect(con1.awaitingNextPhase).toBe(true);
    expect(con1.phase).toBe('study');
    expect(con1.completedPomodoros).toBe(2);
    expect(con2.awaitingNextPhase).toBe(true);
    expect(con2.phase).toBe('study');
    expect(con2.completedPomodoros).toBe(3);
  });

  it('sin ningún tick intermedio detecta la espera y, al iniciar la siguiente, el descanso corto arranca completo (RF-6, RF-10)', () => {
    const state = studyRunning(0, t0);

    // 5 minutos después del fin del estudio y sin ticks intermedios.
    const ended = tickCycle(state, t0 + 30 * MINUTE);

    expect(ended.awaitingNextPhase).toBe(true);
    expect(ended.phase).toBe('study');
    expect(ended.completedPomodoros).toBe(1);
    expect(getRemainingMs(ended.timer, t0 + 30 * MINUTE)).toBe(0);

    // El avance es una acción explícita: el descanso arranca desde AHORA.
    const next = startNextPhase(ended, t0 + 30 * MINUTE);

    expect(next.phase).toBe('shortBreak');
    expect(next.timer.status).toBe('running');
    expect(next.completedPomodoros).toBe(1);
    expect(getRemainingMs(next.timer, t0 + 30 * MINUTE)).toBe(5 * MINUTE);
    expect(formatMmSs(getRemainingMs(next.timer, t0 + 30 * MINUTE))).toBe('05:00');
    expect(getRemainingMs(next.timer, t0 + 32 * MINUTE)).toBe(3 * MINUTE);
  });

  it('con la cuenta sin vencer devuelve el mismo estado sin transición', () => {
    const state = studyRunning(0, t0);

    const next = tickCycle(state, t0 + 10 * MINUTE);

    expect(next).toBe(state);
    expect(next.phase).toBe('study');
    expect(next.completedPomodoros).toBe(0);
  });

  it('sobre un estudio detenido (idle) no hay transición', () => {
    const idle = createInitialCycleState();

    expect(tickCycle(idle, t0 + 30 * MINUTE)).toBe(idle);
  });

  it('con la fase pausada (restante congelado) no hay detección: mismo estado con identidad (RF-9)', () => {
    const paused = pauseCycle(studyRunning(2, t0), t0 + 6 * MINUTE);

    // Pasa muchísimo tiempo, pero estaba pausado: no se cumple nada.
    const next = tickCycle(paused, t0 + 60 * MINUTE);

    expect(next).toBe(paused);
    expect(next.completedPomodoros).toBe(2);
    expect(getRemainingMs(next.timer, t0 + 60 * MINUTE)).toBe(19 * MINUTE);
  });
});

describe('tickCycle — 4.º estudio en primer plano: contador 4 y cero atómico al iniciar (RF-6)', () => {
  it('el 4.º estudio (contador 3) que termina deja la espera con el contador en 4; startNextPhase arranca el descanso largo con cero atómico (RF-2, RF-6)', () => {
    const state = studyRunning(3, t0);

    const ended = tickCycle(state, t0 + 25 * MINUTE);

    expect(ended.awaitingNextPhase).toBe(true);
    expect(ended.phase).toBe('study');
    // El 4.º se cuenta al DETECTAR el fin (decisión 8): la fila se pinta
    // llena mientras dure el estado «fase terminada».
    expect(ended.completedPomodoros).toBe(4);
    expect(getRemainingMs(ended.timer, t0 + 25 * MINUTE)).toBe(0);

    const next = startNextPhase(ended, t0 + 30 * MINUTE);

    expect(next.phase).toBe('longBreak');
    expect(next.timer.status).toBe('running');
    expect(next.completedPomodoros).toBe(0); // cero atómico al arrancar el largo
    expect(getRemainingMs(next.timer, t0 + 30 * MINUTE)).toBe(15 * MINUTE);
    expect(formatMmSs(getRemainingMs(next.timer, t0 + 30 * MINUTE))).toBe('15:00');
  });

  it('una secuencia completa con acción explícita detecta [1, 2, 3, 4] y observa el 4 → 0 al arrancar el largo (RF-2, RF-6)', () => {
    const detectados: number[] = [];
    const arranques: Array<{ phase: Phase; completedPomodoros: number }> = [];
    let state = createInitialCycleState();

    for (let pomodoro = 0; pomodoro < POMODOROS_PER_CYCLE; pomodoro++) {
      // El estudio termina en primer plano → «fase terminada», sin auto-avance.
      state = tickCycle(studyRunning(state.completedPomodoros, t0), t0 + 25 * MINUTE);
      detectados.push(state.completedPomodoros);
      // El usuario inicia la siguiente fase: único camino de avance (RF-8).
      state = startNextPhase(state, t0 + 30 * MINUTE);
      arranques.push({ phase: state.phase, completedPomodoros: state.completedPomodoros });
    }

    expect(detectados).toEqual([1, 2, 3, 4]);
    expect(arranques).toEqual([
      { phase: 'shortBreak', completedPomodoros: 1 },
      { phase: 'shortBreak', completedPomodoros: 2 },
      { phase: 'shortBreak', completedPomodoros: 3 },
      { phase: 'longBreak', completedPomodoros: 0 },
    ]);
  });

  it('sin ningún tick intermedio detecta la espera del 4.º estudio y el largo arranca completo al iniciarlo (RF-6, RF-10)', () => {
    const state = studyRunning(3, t0);

    const ended = tickCycle(state, t0 + 30 * MINUTE);

    expect(ended.awaitingNextPhase).toBe(true);
    expect(ended.phase).toBe('study');
    expect(ended.completedPomodoros).toBe(4);
    expect(getRemainingMs(ended.timer, t0 + 30 * MINUTE)).toBe(0);

    const next = startNextPhase(ended, t0 + 30 * MINUTE);

    expect(next.phase).toBe('longBreak');
    expect(next.completedPomodoros).toBe(0);
    expect(getRemainingMs(next.timer, t0 + 30 * MINUTE)).toBe(15 * MINUTE);
    expect(getRemainingMs(next.timer, t0 + 40 * MINUTE)).toBe(5 * MINUTE);
  });
});

// Descanso en marcha construido a mano (startCycle llega en T5).
function breakRunning(
  phase: 'shortBreak' | 'longBreak',
  completedPomodoros: number,
  startMs: number,
): CycleState {
  const durationMs = getPhaseDurationMs(phase);
  return {
    phase,
    timer: {
      status: 'running',
      durationMs,
      endTimestampMs: startMs + durationMs,
      pausedRemainingMs: null,
    },
    completedPomodoros,
  };
}

describe('tickCycle — descanso que termina en primer plano → espera (RF-6)', () => {
  it('el descanso corto que termina deja la espera con la fase intacta y el contador conservado; al iniciar, estudio de 25:00 (RF-3, RF-6)', () => {
    const state = breakRunning('shortBreak', 1, t0);

    const ended = tickCycle(state, t0 + 5 * MINUTE);

    expect(ended.awaitingNextPhase).toBe(true);
    expect(ended.phase).toBe('shortBreak'); // la fase NO cambia; espera acción
    expect(ended.completedPomodoros).toBe(1); // los descansos no suman pomodoro
    expect(getRemainingMs(ended.timer, t0 + 5 * MINUTE)).toBe(0);

    const next = startNextPhase(ended, t0 + 6 * MINUTE);

    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('running');
    expect(getRemainingMs(next.timer, t0 + 6 * MINUTE)).toBe(25 * MINUTE);
    expect(formatMmSs(getRemainingMs(next.timer, t0 + 6 * MINUTE))).toBe('25:00');
    expect(next.completedPomodoros).toBe(1);
  });

  it('el descanso largo que termina deja la espera con contador 0; al iniciar, estudio de 25:00 (ciclo nuevo, RF-3, RF-6)', () => {
    const state = breakRunning('longBreak', 0, t0);

    const ended = tickCycle(state, t0 + 15 * MINUTE);

    expect(ended.awaitingNextPhase).toBe(true);
    expect(ended.phase).toBe('longBreak');
    expect(ended.completedPomodoros).toBe(0);

    const next = startNextPhase(ended, t0 + 16 * MINUTE);

    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('running');
    expect(getRemainingMs(next.timer, t0 + 16 * MINUTE)).toBe(25 * MINUTE);
    expect(next.completedPomodoros).toBe(0);
  });

  it('sin ningún tick intermedio detecta la espera del descanso y, al iniciar, el estudio arranca completo (RF-6, RF-10)', () => {
    const state = breakRunning('shortBreak', 2, t0);

    // 25 minutos después del fin del descanso y sin ticks intermedios.
    const ended = tickCycle(state, t0 + 30 * MINUTE);

    expect(ended.awaitingNextPhase).toBe(true);
    expect(ended.phase).toBe('shortBreak');
    expect(ended.completedPomodoros).toBe(2);
    expect(getRemainingMs(ended.timer, t0 + 30 * MINUTE)).toBe(0);

    const next = startNextPhase(ended, t0 + 30 * MINUTE);

    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('running');
    expect(getRemainingMs(next.timer, t0 + 30 * MINUTE)).toBe(25 * MINUTE);
    expect(next.completedPomodoros).toBe(2);
  });
});

describe('controles del ciclo sobre cualquier fase (RF-5)', () => {
  it('startCycle inicia un descanso (corto o largo) fijando el fin en ahora + su duración, sin tocar el contador', () => {
    for (const phase of ['shortBreak', 'longBreak'] as const) {
      const state: CycleState = {
        phase,
        timer: createInitialTimerState(getPhaseDurationMs(phase)),
        completedPomodoros: 2,
      };

      const next = startCycle(state, t0);

      expect(next.phase).toBe(phase);
      expect(next.timer.status).toBe('running');
      expect(next.timer.endTimestampMs).toBe(t0 + getPhaseDurationMs(phase));
      expect(getRemainingMs(next.timer, t0)).toBe(getPhaseDurationMs(phase));
      expect(next.completedPomodoros).toBe(2);
    }
  });

  it('startCycle también inicia un estudio desde idle (controles sobre cualquier fase)', () => {
    const state = createInitialCycleState();

    const next = startCycle(state, t0);

    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('running');
    expect(next.timer.endTimestampMs).toBe(t0 + 25 * MINUTE);
    expect(next.completedPomodoros).toBe(0);
  });

  it('pauseCycle congela el restante exacto de un descanso en marcha, sin tocar fase ni contador', () => {
    const state = breakRunning('shortBreak', 1, t0);

    const next = pauseCycle(state, t0 + 2 * MINUTE + 1_000);

    expect(next.phase).toBe('shortBreak');
    expect(next.timer.status).toBe('paused');
    expect(next.timer.pausedRemainingMs).toBe(3 * MINUTE - 1_000);
    expect(next.timer.endTimestampMs).toBeNull();
    // el restante congelado no se mueve aunque pase el tiempo
    expect(getRemainingMs(next.timer, t0 + 60 * MINUTE)).toBe(3 * MINUTE - 1_000);
    expect(next.completedPomodoros).toBe(1);
  });

  it('pauseCycle también pausa un estudio (controles sobre cualquier fase)', () => {
    const state = studyRunning(2, t0);

    const next = pauseCycle(state, t0 + 6 * MINUTE);

    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('paused');
    expect(next.timer.pausedRemainingMs).toBe(19 * MINUTE);
    expect(next.completedPomodoros).toBe(2);
  });

  it('la reanudación de un descanso continúa desde el restante congelado, no desde el inicio', () => {
    const running = breakRunning('longBreak', 0, t0); // fin en t0 + 15 min

    const paused = pauseCycle(running, t0 + 5 * MINUTE); // congela 10 min
    const resumed = startCycle(paused, t0 + 10 * MINUTE); // reanuda 5 min después

    expect(resumed.timer.status).toBe('running');
    expect(resumed.timer.endTimestampMs).toBe(t0 + 20 * MINUTE);
    expect(getRemainingMs(resumed.timer, t0 + 10 * MINUTE)).toBe(10 * MINUTE);
    expect(getRemainingMs(resumed.timer, t0 + 15 * MINUTE)).toBe(5 * MINUTE);
    expect(resumed.completedPomodoros).toBe(0);
  });

  it('cancelResetCycle devuelve exactamente el mismo estado, con identidad, en cualquier fase', () => {
    const estados: CycleState[] = [
      studyRunning(0, t0),
      pauseCycle(studyRunning(2, t0), t0 + 6 * MINUTE),
      breakRunning('shortBreak', 1, t0),
      pauseCycle(breakRunning('shortBreak', 1, t0), t0 + MINUTE),
      breakRunning('longBreak', 0, t0),
      createInitialCycleState(),
    ];

    for (const estado of estados) {
      expect(cancelResetCycle(estado)).toBe(estado);
    }
  });
});

describe('confirmResetCycle — reinicio de la fase actual (RF-6, RF-7)', () => {
  it('reinicia un descanso corto corriendo a su tiempo inicial detenido, con el contador intacto (RF-6)', () => {
    const state = breakRunning('shortBreak', 2, t0);

    const next = confirmResetCycle(state);

    expect(next.phase).toBe('shortBreak');
    expect(next.timer.status).toBe('idle');
    expect(next.timer.durationMs).toBe(5 * MINUTE);
    expect(next.timer.endTimestampMs).toBeNull();
    expect(next.timer.pausedRemainingMs).toBeNull();
    expect(getRemainingMs(next.timer, t0)).toBe(5 * MINUTE);
    expect(next.completedPomodoros).toBe(2);
  });

  it('reinicia un descanso corto pausado a su tiempo inicial detenido, con el contador intacto (RF-6)', () => {
    const paused = pauseCycle(breakRunning('shortBreak', 1, t0), t0 + 2 * MINUTE);

    const next = confirmResetCycle(paused);

    expect(next.phase).toBe('shortBreak');
    expect(next.timer.status).toBe('idle');
    expect(next.timer.endTimestampMs).toBeNull();
    expect(getRemainingMs(next.timer, t0 + 2 * MINUTE)).toBe(5 * MINUTE);
    expect(next.completedPomodoros).toBe(1);
  });

  it('reinicia un descanso largo (corriendo y pausado) a 15:00 detenido, con el contador intacto (RF-6)', () => {
    const corriendo = breakRunning('longBreak', 0, t0);
    const pausado = pauseCycle(breakRunning('longBreak', 3, t0), t0 + 5 * MINUTE);

    const alCorrer = confirmResetCycle(corriendo);
    const alPausar = confirmResetCycle(pausado);

    expect(alCorrer.timer.status).toBe('idle');
    expect(getRemainingMs(alCorrer.timer, t0)).toBe(15 * MINUTE);
    expect(alCorrer.completedPomodoros).toBe(0);
    expect(alPausar.timer.status).toBe('idle');
    expect(getRemainingMs(alPausar.timer, t0 + 5 * MINUTE)).toBe(15 * MINUTE);
    expect(alPausar.completedPomodoros).toBe(3);
  });

  it('reinicia un estudio a mitad (corriendo y pausado) a 25:00 detenido, con el contador del ciclo intacto (RF-7)', () => {
    const corriendo = studyRunning(2, t0);
    const pausado = pauseCycle(studyRunning(3, t0), t0 + 10 * MINUTE);

    const alCorrer = confirmResetCycle(corriendo);
    const alPausar = confirmResetCycle(pausado);

    expect(alCorrer.phase).toBe('study');
    expect(alCorrer.timer.status).toBe('idle');
    expect(getRemainingMs(alCorrer.timer, t0)).toBe(25 * MINUTE);
    expect(alCorrer.completedPomodoros).toBe(2);
    expect(alPausar.timer.status).toBe('idle');
    expect(getRemainingMs(alPausar.timer, t0 + 10 * MINUTE)).toBe(25 * MINUTE);
    expect(alPausar.completedPomodoros).toBe(3);
  });

  it('ninguna ruta produce arranque automático: siempre termina detenida a su tiempo inicial (RF-6)', () => {
    // Todas las fases × {corriendo, corriendo vencida sin tick, pausada, detenida}.
    for (const phase of ['study', 'shortBreak', 'longBreak'] as const) {
      const durationMs = getPhaseDurationMs(phase);
      const estados: CycleState[] = [
        { phase, timer: { status: 'running', durationMs, endTimestampMs: t0 + durationMs, pausedRemainingMs: null }, completedPomodoros: 2 },
        { phase, timer: { status: 'running', durationMs, endTimestampMs: t0 - 1_000, pausedRemainingMs: null }, completedPomodoros: 2 },
        { phase, timer: { status: 'paused', durationMs, endTimestampMs: null, pausedRemainingMs: durationMs - 3 * MINUTE }, completedPomodoros: 2 },
        { phase, timer: createInitialTimerState(durationMs), completedPomodoros: 2 },
      ];

      for (const estado of estados) {
        const next = confirmResetCycle(estado);

        expect(next.timer.status).toBe('idle');
        expect(next.timer.endTimestampMs).toBeNull();
        expect(next.timer.pausedRemainingMs).toBeNull();
        expect(next.timer.durationMs).toBe(durationMs);
        expect(next.completedPomodoros).toBe(2);
      }
    }
  });

  it('reiniciar desde «fase terminada» descarta la espera: fase actual a tiempo inicial detenida, progreso intacto (RF-6, T8)', () => {
    // Estudio cumplido con la app cerrada → awaiting con el pomodoro ya contado.
    const lejos = detectPhaseEndWhileAway(startCycle(createInitialCycleState(), t0), t0 + 30 * MINUTE);
    expect(lejos.awaitingNextPhase).toBe(true);

    const next = confirmResetCycle(lejos);

    // La reiniciada es una acción explícita que RESUELVE la espera (RF-6):
    // sin awaiting, la pantalla vuelve al estado normal «Iniciar».
    expect(next.awaitingNextPhase).toBe(false);
    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('idle');
    expect(getRemainingMs(next.timer, t0 + 30 * MINUTE)).toBe(DEFAULT_STUDY_DURATION_MS);
    // El avance del ciclo NO se pierde al reiniciar (pomodoro-rules: progreso conservado).
    expect(next.completedPomodoros).toBe(1);
  });
});

describe('advanceToNextPhase — transición 002 extraída (RF-7, RF-12)', () => {
  it('estudio con contador < 3 → descanso corto detenido con contador +1', () => {
    const state = studyRunning(1, t0);

    const next = advanceToNextPhase(state);

    expect(next.phase).toBe('shortBreak');
    expect(next.timer.status).toBe('idle');
    expect(next.timer.endTimestampMs).toBeNull();
    expect(next.timer.pausedRemainingMs).toBeNull();
    expect(getRemainingMs(next.timer, t0)).toBe(5 * MINUTE);
    expect(next.completedPomodoros).toBe(2);
  });

  it('4.º estudio (contador 3) → descanso largo detenido con cero atómico en la misma transición', () => {
    const next = advanceToNextPhase(studyRunning(3, t0));

    expect(next.phase).toBe('longBreak');
    expect(next.timer.status).toBe('idle');
    expect(getRemainingMs(next.timer, t0)).toBe(15 * MINUTE);
    expect(next.completedPomodoros).toBe(0);
  });

  it('descanso (corto o largo) → estudio detenido con el contador intacto', () => {
    const corto = advanceToNextPhase(breakRunning('shortBreak', 2, t0));
    const largo = advanceToNextPhase(breakRunning('longBreak', 0, t0));

    expect(corto.phase).toBe('study');
    expect(corto.timer.status).toBe('idle');
    expect(getRemainingMs(corto.timer, t0)).toBe(25 * MINUTE);
    expect(corto.completedPomodoros).toBe(2);
    expect(largo.phase).toBe('study');
    expect(largo.timer.status).toBe('idle');
    expect(getRemainingMs(largo.timer, t0)).toBe(25 * MINUTE);
    expect(largo.completedPomodoros).toBe(0);
  });

  it('el resultado siempre deja awaitingNextPhase en false (RF-6)', () => {
    const estados: CycleState[] = [
      { ...studyRunning(0, t0), awaitingNextPhase: true },
      { ...studyRunning(3, t0), awaitingNextPhase: true },
      { ...breakRunning('shortBreak', 1, t0), awaitingNextPhase: true },
    ];

    for (const estado of estados) {
      expect(advanceToNextPhase(estado).awaitingNextPhase).toBe(false);
    }
  });
});

describe('tickCycle — guardia de awaitingNextPhase (RF-6)', () => {
  it('con awaitingNextPhase en true devuelve el mismo estado aunque la cuenta esté vencida (no avanza)', () => {
    const state: CycleState = { ...studyRunning(0, t0), awaitingNextPhase: true };

    // El estudio ya venció, pero la fase está «esperando acción»: NO se avanza.
    const next = tickCycle(state, t0 + 30 * MINUTE);

    expect(next).toBe(state);
    expect(next.phase).toBe('study');
    expect(next.completedPomodoros).toBe(0);
  });

  it('sin awaitingNextPhase (ausente o false) el fin en primer plano pasa a la espera con contador +1 (regresión de 002 ajustada, RF-6)', () => {
    const ausente = tickCycle(studyRunning(0, t0), t0 + 25 * MINUTE);
    const explicito = tickCycle({ ...studyRunning(0, t0), awaitingNextPhase: false }, t0 + 25 * MINUTE);

    expect(ausente.awaitingNextPhase).toBe(true);
    expect(ausente.phase).toBe('study');
    expect(ausente.completedPomodoros).toBe(1);
    expect(explicito.awaitingNextPhase).toBe(true);
    expect(explicito.phase).toBe('study');
    expect(explicito.completedPomodoros).toBe(1);
  });
});

describe('detectPhaseEndWhileAway — fase cumplida con la app cerrada/en segundo plano (RF-1, RF-2, RF-6, RF-7, RF-9, RF-12)', () => {
  it('estudio running vencido → awaiting, fase intacta, contador +1 y restante 0 (RF-6, RF-7)', () => {
    const state = studyRunning(1, t0);

    const next = detectPhaseEndWhileAway(state, t0 + 25 * MINUTE);

    expect(next.awaitingNextPhase).toBe(true);
    expect(next.phase).toBe('study'); // la fase NO cambia; espera acción
    expect(next.completedPomodoros).toBe(2);
    expect(getRemainingMs(next.timer, t0 + 25 * MINUTE)).toBe(0);
    expect(formatMmSs(getRemainingMs(next.timer, t0 + 25 * MINUTE))).toBe('00:00');
  });

  it('descanso running vencido → awaiting y contador SIN cambiar (RF-6)', () => {
    const state = breakRunning('shortBreak', 1, t0);

    const next = detectPhaseEndWhileAway(state, t0 + 5 * MINUTE);

    expect(next.awaitingNextPhase).toBe(true);
    expect(next.phase).toBe('shortBreak');
    expect(next.completedPomodoros).toBe(1); // los descansos no suman pomodoro
    expect(getRemainingMs(next.timer, t0 + 5 * MINUTE)).toBe(0);
  });

  it('running aún no vencido → devuelve el MISMO estado, con identidad (RF-1, RF-2)', () => {
    const state = studyRunning(0, t0);

    const next = detectPhaseEndWhileAway(state, t0 + 10 * MINUTE);

    expect(next).toBe(state);
    expect(next.awaitingNextPhase).toBeFalsy();
  });

  it('paused (restante congelado) → devuelve el MISMO estado, sin contador (RF-9)', () => {
    const paused = pauseCycle(studyRunning(2, t0), t0 + 6 * MINUTE);

    // Pasa muchísimo tiempo con la app cerrada, pero estaba pausado: no se cumple.
    const next = detectPhaseEndWhileAway(paused, t0 + 60 * MINUTE);

    expect(next).toBe(paused);
    expect(next.completedPomodoros).toBe(2);
    expect(getRemainingMs(next.timer, t0 + 60 * MINUTE)).toBe(19 * MINUTE);
  });

  it('idle → devuelve el MISMO estado, con identidad', () => {
    const idle = createInitialCycleState();

    expect(detectPhaseEndWhileAway(idle, t0 + 30 * MINUTE)).toBe(idle);
  });

  it('dos llamadas seguidas NO duplican el contador (RF-7, decisión 8)', () => {
    const state = studyRunning(0, t0);

    const primera = detectPhaseEndWhileAway(state, t0 + 25 * MINUTE);
    const segunda = detectPhaseEndWhileAway(primera, t0 + 40 * MINUTE);

    expect(segunda.awaitingNextPhase).toBe(true);
    expect(segunda.completedPomodoros).toBe(1); // sigue en 1, no en 2
  });

  it('con awaitingNextPhase ya en true devuelve el mismo estado sin tocar el contador', () => {
    const state: CycleState = { ...studyRunning(0, t0), awaitingNextPhase: true, completedPomodoros: 1 };

    expect(detectPhaseEndWhileAway(state, t0 + 40 * MINUTE)).toBe(state);
    expect(state.completedPomodoros).toBe(1);
  });

  it('el 4.º estudio (contador 3) cumplido lejos deja el contador en 4 y awaiting (RF-7)', () => {
    const next = detectPhaseEndWhileAway(studyRunning(3, t0), t0 + 25 * MINUTE);

    expect(next.awaitingNextPhase).toBe(true);
    expect(next.completedPomodoros).toBe(4); // el 4.º sí cuenta al detectarse (decisión 8)
    expect(next.phase).toBe('study');
  });
});

describe('startNextPhase — inicia la siguiente fase desde el estado terminado (RF-7, RF-8)', () => {
  it('desde awaiting de un estudio → arranca la siguiente (descanso corto) corriendo, con awaiting en false', () => {
    // detect: estudio vencido con contador 1 → contador 2 (una sola suma, decisión 8)
    const awaiting = detectPhaseEndWhileAway(studyRunning(1, t0), t0 + 25 * MINUTE);
    expect(awaiting.completedPomodoros).toBe(2);

    const next = startNextPhase(awaiting, t0 + 40 * MINUTE);

    expect(next.phase).toBe('shortBreak');
    expect(next.timer.status).toBe('running');
    expect(next.completedPomodoros).toBe(2); // el avance NO vuelve a sumar: ya se contó al detectar
    expect(next.awaitingNextPhase).toBe(false);
    // la siguiente fase arranca a su tiempo completo desde el momento en que el usuario la inicia
    expect(next.timer.endTimestampMs).toBe(t0 + 40 * MINUTE + 5 * MINUTE);
    expect(getRemainingMs(next.timer, t0 + 40 * MINUTE)).toBe(5 * MINUTE);
  });

  it('desde awaiting del 4.º estudio → descanso largo corriendo con cero atómico (RF-7)', () => {
    const awaiting = detectPhaseEndWhileAway(studyRunning(3, t0), t0 + 25 * MINUTE);
    expect(awaiting.completedPomodoros).toBe(4); // el 4.º cuenta al detectarse

    const next = startNextPhase(awaiting, t0 + 30 * MINUTE);

    expect(next.phase).toBe('longBreak');
    expect(next.timer.status).toBe('running');
    expect(next.completedPomodoros).toBe(0); // cero atómico al arrancar el largo
    expect(next.awaitingNextPhase).toBe(false);
    expect(getRemainingMs(next.timer, t0 + 30 * MINUTE)).toBe(15 * MINUTE);
  });

  it('desde awaiting de un descanso → arranca el estudio corriendo con el contador intacto (RF-8)', () => {
    const awaiting = detectPhaseEndWhileAway(breakRunning('shortBreak', 2, t0), t0 + 5 * MINUTE);
    expect(awaiting.awaitingNextPhase).toBe(true);

    const next = startNextPhase(awaiting, t0 + 10 * MINUTE);

    expect(next.phase).toBe('study');
    expect(next.timer.status).toBe('running');
    expect(next.completedPomodoros).toBe(2); // el descanso no toca el contador
    expect(next.awaitingNextPhase).toBe(false);
    expect(getRemainingMs(next.timer, t0 + 10 * MINUTE)).toBe(25 * MINUTE);
  });

  it('sin awaiting (corriendo, pausado o detenido) devuelve el MISMO estado, con identidad', () => {
    const estados: CycleState[] = [
      studyRunning(0, t0),
      pauseCycle(studyRunning(2, t0), t0 + 6 * MINUTE),
      createInitialCycleState(),
    ];

    for (const estado of estados) {
      expect(startNextPhase(estado, t0 + 10 * MINUTE)).toBe(estado);
    }
  });
});

describe('isPhaseEndedAwaiting y getCyclePrimaryButtonLabel (RF-6, RF-8)', () => {
  it('isPhaseEndedAwaiting refleja el flag awaitingNextPhase', () => {
    expect(isPhaseEndedAwaiting({ ...studyRunning(0, t0), awaitingNextPhase: true })).toBe(true);
    expect(isPhaseEndedAwaiting(studyRunning(0, t0))).toBe(false); // flag ausente
    expect(isPhaseEndedAwaiting({ ...studyRunning(0, t0), awaitingNextPhase: false })).toBe(false);
  });

  it('en awaiting el botón es «Iniciar siguiente» (RF-8)', () => {
    const label = getCyclePrimaryButtonLabel({ ...studyRunning(1, t0), awaitingNextPhase: true });
    expect(label).toBe('Iniciar siguiente');
  });

  it('fuera de awaiting delega en la etiqueta normal del temporizador', () => {
    expect(getCyclePrimaryButtonLabel(studyRunning(0, t0))).toBe('Pausar'); // running
    expect(getCyclePrimaryButtonLabel(pauseCycle(studyRunning(2, t0), t0 + 6 * MINUTE))).toBe('Reanudar'); // paused
    expect(getCyclePrimaryButtonLabel(createInitialCycleState())).toBe('Iniciar'); // idle
  });
});

// ---------------------------------------------------------------------------
// Spec 005 (T2): config propio del ciclo. Los ajustes llegan como parámetro
// opcional; sin argumento todo se comporta igual que hoy (regresión 001–004).
// ---------------------------------------------------------------------------

// Config personalizado de prueba: 40/10/20 y ciclo de 3.
const CONFIG_40: PomodoroConfig = {
  durationsMs: {
    study: 40 * MINUTE,
    shortBreak: 10 * MINUTE,
    longBreak: 20 * MINUTE,
  },
  pomodorosPerCycle: 3,
};

describe('PomodoroConfig y DEFAULT_POMODORO_CONFIG (005, T2 — RF-1)', () => {
  it('el default refleja los valores actuales 25/5/15/4', () => {
    expect(DEFAULT_POMODORO_CONFIG).toEqual({
      durationsMs: {
        study: 25 * MINUTE,
        shortBreak: 5 * MINUTE,
        longBreak: 15 * MINUTE,
      },
      pomodorosPerCycle: 4,
    });
  });

  it('createInitialCycleState sin argumento sigue arrancando a 25:00 (regresión 001–004)', () => {
    const estado = createInitialCycleState();
    expect(estado.phase).toBe('study');
    expect(estado.timer.status).toBe('idle');
    expect(estado.timer.durationMs).toBe(DEFAULT_STUDY_DURATION_MS);
    expect(estado.completedPomodoros).toBe(0);
  });

  it('createInitialCycleState con config propio arranca con su duración de estudio', () => {
    const estado = createInitialCycleState(CONFIG_40);
    expect(estado.timer.status).toBe('idle');
    expect(estado.timer.durationMs).toBe(40 * MINUTE);
    expect(estado.completedPomodoros).toBe(0);
  });

  it('getPomodorosCompletados admite el tamaño de ciclo del config; sin argumento = 4 casilleros', () => {
    expect(getPomodorosCompletados(1, 2)).toEqual([true, false]);
    expect(getPomodorosCompletados(0, 3)).toEqual([false, false, false]);
    expect(getPomodorosCompletados(3, 2)).toEqual([true, true]); // contador > valor nuevo
    expect(getPomodorosCompletados(1)).toEqual([true, false, false, false]);
  });
});

describe('applySettingsToCycle — aplica ajustes solo a la fase detenida (005, T2 — RF-7)', () => {
  it('fase idle de estudio → durationMs nuevo, contador intacto', () => {
    const estado: CycleState = {
      ...createInitialCycleState(),
      completedPomodoros: 2,
    };

    const aplicado = applySettingsToCycle(estado, CONFIG_40);

    expect(aplicado.timer.status).toBe('idle');
    expect(aplicado.timer.durationMs).toBe(40 * MINUTE);
    expect(aplicado.phase).toBe('study');
    expect(aplicado.completedPomodoros).toBe(2);
    expect(aplicado.timer.endTimestampMs).toBeNull();
  });

  it('fase idle de descanso → durationMs del descanso según config, contador intacto', () => {
    const estado: CycleState = {
      phase: 'shortBreak',
      timer: createInitialTimerState(5 * MINUTE),
      completedPomodoros: 1,
    };

    const aplicado = applySettingsToCycle(estado, CONFIG_40);

    expect(aplicado.timer.durationMs).toBe(10 * MINUTE);
    expect(aplicado.completedPomodoros).toBe(1);
  });

  it('fase corriendo → identidad: endTimestampMs intacto, contador intacto', () => {
    const corriendo = studyRunning(2, t0);

    const aplicado = applySettingsToCycle(corriendo, CONFIG_40);

    expect(aplicado).toBe(corriendo);
    expect(aplicado.timer.endTimestampMs).toBe(t0 + 25 * MINUTE);
    expect(aplicado.completedPomodoros).toBe(2);
  });

  it('fase pausada → identidad: pausedRemainingMs intacto, contador intacto', () => {
    const pausado = pauseCycle(studyRunning(1, t0), t0 + 5 * MINUTE);

    const aplicado = applySettingsToCycle(pausado, CONFIG_40);

    expect(aplicado).toBe(pausado);
    expect(aplicado.timer.pausedRemainingMs).toBe(20 * MINUTE);
    expect(aplicado.completedPomodoros).toBe(1);
  });

  it('idle con el MISMO durationMs → identidad (sin repintado ni escritura)', () => {
    const estado = createInitialCycleState();
    expect(applySettingsToCycle(estado, DEFAULT_POMODORO_CONFIG)).toBe(estado);
  });
});

describe('transiciones con config propio (005, T2 — RF-1, RF-8)', () => {
  const config2: PomodoroConfig = {
    durationsMs: {
      study: 40 * MINUTE,
      shortBreak: 10 * MINUTE,
      longBreak: 20 * MINUTE,
    },
    pomodorosPerCycle: 2,
  };

  it('advanceToNextPhase con valor 2: el 2.º estudio → longBreak con cero atómico', () => {
    const estado: CycleState = {
      phase: 'study',
      timer: createInitialTimerState(40 * MINUTE),
      completedPomodoros: 1,
      awaitingNextPhase: false,
    };

    const siguiente = advanceToNextPhase(estado, config2);

    expect(siguiente.phase).toBe('longBreak');
    expect(siguiente.completedPomodoros).toBe(0);
    expect(siguiente.timer.status).toBe('idle');
    expect(siguiente.timer.durationMs).toBe(20 * MINUTE); // duración del config
  });

  it('advanceToNextPhase: contador 3 con valor 2 → longBreak con cero atómico', () => {
    const estado: CycleState = {
      phase: 'study',
      timer: createInitialTimerState(40 * MINUTE),
      completedPomodoros: 3,
      awaitingNextPhase: false,
    };

    const siguiente = advanceToNextPhase(estado, config2);

    expect(siguiente.phase).toBe('longBreak');
    expect(siguiente.completedPomodoros).toBe(0);
  });

  it('advanceToNextPhase: contador 1 con valor 3 → shortBreak y sigue contando', () => {
    const estado: CycleState = {
      phase: 'study',
      timer: createInitialTimerState(40 * MINUTE),
      completedPomodoros: 1,
      awaitingNextPhase: false,
    };

    const siguiente = advanceToNextPhase(estado, CONFIG_40);

    expect(siguiente.phase).toBe('shortBreak');
    expect(siguiente.completedPomodoros).toBe(2); // sigue contando
    expect(siguiente.timer.durationMs).toBe(10 * MINUTE); // duración del config
  });

  it('startNextPhase con valor 2: contador 3 ya contado → longBreak con cero atómico', () => {
    const cumplida: CycleState = {
      phase: 'study',
      timer: { status: 'running', durationMs: 40 * MINUTE, endTimestampMs: t0, pausedRemainingMs: null },
      completedPomodoros: 3,
      awaitingNextPhase: true,
    };

    const arrancada = startNextPhase(cumplida, t0 + MINUTE, config2);

    expect(arrancada.phase).toBe('longBreak');
    expect(arrancada.completedPomodoros).toBe(0);
    expect(arrancada.timer.status).toBe('running');
    expect(arrancada.timer.durationMs).toBe(20 * MINUTE);
    expect(arrancada.timer.endTimestampMs).toBe(t0 + MINUTE + 20 * MINUTE);
  });

  it('startNextPhase: la siguiente fase arranca con la duración de esa fase en el config', () => {
    const cumplida: CycleState = {
      phase: 'shortBreak',
      timer: { status: 'running', durationMs: 10 * MINUTE, endTimestampMs: t0, pausedRemainingMs: null },
      completedPomodoros: 1,
      awaitingNextPhase: true,
    };

    const arrancada = startNextPhase(cumplida, t0 + MINUTE, CONFIG_40);

    expect(arrancada.phase).toBe('study');
    expect(arrancada.timer.status).toBe('running');
    expect(arrancada.timer.durationMs).toBe(40 * MINUTE);
    expect(arrancada.timer.endTimestampMs).toBe(t0 + MINUTE + 40 * MINUTE);
    expect(arrancada.completedPomodoros).toBe(1); // contador intacto
  });

  it('startNextPhase sin argumento arranca el descanso corto a 5:00 (regresión)', () => {
    const cumplida: CycleState = {
      phase: 'study',
      timer: { status: 'running', durationMs: 25 * MINUTE, endTimestampMs: t0, pausedRemainingMs: null },
      completedPomodoros: 2,
      awaitingNextPhase: true,
    };

    const arrancada = startNextPhase(cumplida, t0 + MINUTE);

    expect(arrancada.phase).toBe('shortBreak');
    expect(arrancada.timer.durationMs).toBe(5 * MINUTE);
    expect(arrancada.completedPomodoros).toBe(2);
  });

  it('confirmResetCycle con config: reinicia a la duración de esa fase en el config, contador intacto', () => {
    const estado: CycleState = {
      phase: 'longBreak',
      timer: { status: 'running', durationMs: 20 * MINUTE, endTimestampMs: t0 + MINUTE, pausedRemainingMs: null },
      completedPomodoros: 2,
      awaitingNextPhase: false,
    };

    const reiniciado = confirmResetCycle(estado, CONFIG_40);

    expect(reiniciado.timer.status).toBe('idle');
    expect(reiniciado.timer.durationMs).toBe(20 * MINUTE); // longBreak del config, no el de 15
    expect(getRemainingMs(reiniciado.timer, t0)).toBe(20 * MINUTE);
    expect(reiniciado.completedPomodoros).toBe(2);
    expect(reiniciado.timer.endTimestampMs).toBeNull();
  });

  it('confirmResetCycle sin argumento reinicia a 15:00 (regresión)', () => {
    const estado: CycleState = {
      phase: 'longBreak',
      timer: { status: 'running', durationMs: 15 * MINUTE, endTimestampMs: t0 + MINUTE, pausedRemainingMs: null },
      completedPomodoros: 2,
      awaitingNextPhase: false,
    };

    const reiniciado = confirmResetCycle(estado);

    expect(getRemainingMs(reiniciado.timer, t0)).toBe(15 * MINUTE);
    expect(reiniciado.completedPomodoros).toBe(2);
  });
});
