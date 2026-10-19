import {
  DEFAULT_STUDY_DURATION_MS,
  cancelReset,
  confirmReset,
  createInitialTimerState,
  formatMmSs,
  getPrimaryButtonLabel,
  getRemainingMs,
  pause,
  start,
  tick,
  type TimerState,
} from '../timer';

// Reloj fijo inyectado: sin fake timers, tests deterministas (plan, sección 7).
const t0 = 1_700_000_000_000;
const MINUTE = 60 * 1000;

// Estados construidos a mano: start/pause llegan en T3.
function runningFrom(nowMs: number, durationMs = DEFAULT_STUDY_DURATION_MS): TimerState {
  return { status: 'running', durationMs, endTimestampMs: nowMs + durationMs, pausedRemainingMs: null };
}

function pausedWith(remainingMs: number, durationMs = DEFAULT_STUDY_DURATION_MS): TimerState {
  return { status: 'paused', durationMs, endTimestampMs: null, pausedRemainingMs: remainingMs };
}

function finishedAt(durationMs = DEFAULT_STUDY_DURATION_MS): TimerState {
  return { status: 'finished', durationMs, endTimestampMs: null, pausedRemainingMs: null };
}

describe('createInitialTimerState', () => {
  it('arranca en estado idle con el tiempo de estudio por defecto detenido (25 min)', () => {
    const state = createInitialTimerState();

    expect(state.status).toBe('idle');
    expect(state.durationMs).toBe(DEFAULT_STUDY_DURATION_MS);
    expect(state.durationMs).toBe(25 * 60 * 1000);
    expect(state.endTimestampMs).toBeNull();
    expect(state.pausedRemainingMs).toBeNull();
  });

  it('acepta un tiempo de estudio personalizado', () => {
    const state = createInitialTimerState(10 * 60 * 1000);

    expect(state.status).toBe('idle');
    expect(state.durationMs).toBe(10 * 60 * 1000);
    expect(state.endTimestampMs).toBeNull();
    expect(state.pausedRemainingMs).toBeNull();
  });
});

describe('getRemainingMs', () => {
  it('en idle devuelve el tiempo inicial completo (RF-1)', () => {
    const state = createInitialTimerState();

    expect(getRemainingMs(state, t0)).toBe(25 * MINUTE);
  });

  it('en running descuenta de forma exacta según la marca de fin (RF-1, RF-2)', () => {
    const state = runningFrom(t0);

    expect(getRemainingMs(state, t0)).toBe(25 * MINUTE);
    expect(getRemainingMs(state, t0 + 1_000)).toBe(25 * MINUTE - 1_000);
  });

  it('con la app en segundo plano y sin ningún tick intermedio da el valor exacto (RF-5)', () => {
    const state = runningFrom(t0);

    // 10 minutos sin "tick": el cálculo es por timestamp, no por decrementos.
    expect(getRemainingMs(state, t0 + 10 * MINUTE)).toBe(15 * MINUTE);
    expect(formatMmSs(getRemainingMs(state, t0 + 10 * MINUTE))).toBe('15:00');
  });

  it('en paused devuelve el restante congelado sin importar cuánto tiempo pase (RF-3, RF-4)', () => {
    const state = pausedWith(7 * MINUTE + 30_000);

    expect(getRemainingMs(state, t0)).toBe(7 * MINUTE + 30_000);
    expect(getRemainingMs(state, t0 + 60 * MINUTE)).toBe(7 * MINUTE + 30_000);
  });

  it('en finished devuelve 0 y jamás un valor negativo (RF-6)', () => {
    expect(getRemainingMs(finishedAt(), t0)).toBe(0);
    // running con la marca de fin ya vencida: nunca negativo.
    const expired: TimerState = {
      status: 'running',
      durationMs: DEFAULT_STUDY_DURATION_MS,
      endTimestampMs: t0 - 5 * MINUTE,
      pausedRemainingMs: null,
    };
    expect(getRemainingMs(expired, t0)).toBe(0);
  });
});

describe('formatMmSs', () => {
  it('formatea minutos y segundos con dos dígitos (RF-2)', () => {
    expect(formatMmSs(25 * MINUTE)).toBe('25:00');
    expect(formatMmSs(5 * MINUTE + 1_000)).toBe('05:01');
    expect(formatMmSs(9_000)).toBe('00:09');
    expect(formatMmSs(59_999)).toBe('00:59');
  });

  it('redondea hacia abajo y se clava en 00:00 para 0 o valores negativos (RF-6)', () => {
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(-1_000)).toBe('00:00');
    expect(formatMmSs(1_499)).toBe('00:01');
  });
});

describe('getPrimaryButtonLabel', () => {
  it('muestra la etiqueta según el estado del temporizador (RF-11)', () => {
    expect(getPrimaryButtonLabel(createInitialTimerState())).toBe('Iniciar');
    expect(getPrimaryButtonLabel(runningFrom(t0))).toBe('Pausar');
    expect(getPrimaryButtonLabel(pausedWith(MINUTE))).toBe('Reanudar');
    expect(getPrimaryButtonLabel(finishedAt())).toBe('Iniciar');
  });
});

describe('start', () => {
  it('desde idle comienza la cuenta con fin en ahora + 25 min (RF-1)', () => {
    const state = start(createInitialTimerState(), t0);

    expect(state.status).toBe('running');
    expect(state.endTimestampMs).toBe(t0 + 25 * MINUTE);
    expect(getRemainingMs(state, t0)).toBe(25 * MINUTE);
    // y el restante desciende de forma exacta segundo a segundo
    expect(getRemainingMs(state, t0 + 1_000)).toBe(25 * MINUTE - 1_000);
  });

  it('desde paused continúa desde el tiempo congelado, no desde el inicio (RF-4)', () => {
    const paused = pausedWith(7 * MINUTE + 30_000);

    const state = start(paused, t0);

    expect(state.status).toBe('running');
    expect(state.endTimestampMs).toBe(t0 + 7 * MINUTE + 30_000);
    expect(getRemainingMs(state, t0)).toBe(7 * MINUTE + 30_000);
    expect(getRemainingMs(state, t0 + 30_000)).toBe(7 * MINUTE);
  });

  it('sobre running es no-op: no reinicia la cuenta', () => {
    const running = runningFrom(t0);

    const state = start(running, t0 + 5 * MINUTE);

    expect(state).toBe(running);
    expect(state.endTimestampMs).toBe(t0 + 25 * MINUTE);
  });

  it('desde finished (contador en 00:00) vuelve al tiempo inicial y arranca una ronda nueva (RF-7)', () => {
    const state = start(finishedAt(), t0);

    expect(state.status).toBe('running');
    expect(state.endTimestampMs).toBe(t0 + 25 * MINUTE);
    expect(getRemainingMs(state, t0)).toBe(25 * MINUTE);
  });
});

describe('pause', () => {
  it('desde running congela el restante exacto en el instante de la pulsación (RF-3)', () => {
    const running = runningFrom(t0);

    const state = pause(running, t0 + 6 * MINUTE + 12_000);

    expect(state.status).toBe('paused');
    expect(state.pausedRemainingMs).toBe(25 * MINUTE - 6 * MINUTE - 12_000);
    expect(state.endTimestampMs).toBeNull();
    // el tiempo congelado no se mueve aunque pase el tiempo
    expect(getRemainingMs(state, t0 + 60 * MINUTE)).toBe(25 * MINUTE - 6 * MINUTE - 12_000);
  });

  it('con la marca de fin ya vencida pasa a finished sin restante negativo (RF-6)', () => {
    const expired: TimerState = {
      status: 'running',
      durationMs: DEFAULT_STUDY_DURATION_MS,
      endTimestampMs: t0 - 1_000,
      pausedRemainingMs: null,
    };

    const state = pause(expired, t0);

    expect(state.status).toBe('finished');
    expect(getRemainingMs(state, t0)).toBe(0);
  });

  it('con el contador ya en 00:00 no hace nada (pausar en finished es no-op)', () => {
    const finished = finishedAt();

    expect(pause(finished, t0)).toBe(finished);
  });
});

describe('tick', () => {
  it('con la cuenta vencida pasa a finished y clava el restante en 00:00 (RF-6)', () => {
    const running = runningFrom(t0);

    const state = tick(running, t0 + 25 * MINUTE);

    expect(state.status).toBe('finished');
    expect(state.endTimestampMs).toBeNull();
    expect(getRemainingMs(state, t0 + 25 * MINUTE)).toBe(0);
    expect(formatMmSs(getRemainingMs(state, t0 + 25 * MINUTE))).toBe('00:00');
  });

  it('con la cuenta vencida hace rato (ahora muy posterior) sigue en 00:00, nunca negativo (RF-6)', () => {
    const running = runningFrom(t0);

    const state = tick(running, t0 + 40 * MINUTE);

    expect(state.status).toBe('finished');
    expect(getRemainingMs(state, t0 + 40 * MINUTE)).toBe(0);
  });

  it('sin vencer devuelve el mismo estado sin alterar la cuenta (RF-2)', () => {
    const running = runningFrom(t0);

    expect(tick(running, t0 + 10 * MINUTE)).toBe(running);
    expect(getRemainingMs(tick(running, t0 + 10 * MINUTE), t0 + 10 * MINUTE)).toBe(15 * MINUTE);
  });

  it('en paused, idle o finished no hace nada', () => {
    const paused = pausedWith(MINUTE);
    const idle = createInitialTimerState();
    const finished = finishedAt();

    expect(tick(paused, t0 + 5 * MINUTE)).toBe(paused);
    expect(tick(idle, t0 + 5 * MINUTE)).toBe(idle);
    expect(tick(finished, t0 + 5 * MINUTE)).toBe(finished);
  });

  it('una ronda completa: arrancar, correr hasta vencer y volver a arrancar da el tiempo inicial (RF-6, RF-7)', () => {
    const started = start(createInitialTimerState(), t0);
    const finished = tick(started, t0 + 25 * MINUTE + 1_000);
    const restarted = start(finished, t0 + 26 * MINUTE);

    expect(finished.status).toBe('finished');
    expect(getRemainingMs(finished, t0 + 26 * MINUTE)).toBe(0);
    expect(restarted.status).toBe('running');
    expect(getRemainingMs(restarted, t0 + 26 * MINUTE)).toBe(25 * MINUTE);
  });
});

describe('confirmReset', () => {
  it('con contador corriendo distinto de 00:00 vuelve al tiempo inicial y se detiene (RF-9)', () => {
    const running = runningFrom(t0);

    const state = confirmReset(running, t0 + 6 * MINUTE);

    expect(state.status).toBe('idle');
    expect(state.durationMs).toBe(DEFAULT_STUDY_DURATION_MS);
    expect(getRemainingMs(state, t0 + 6 * MINUTE)).toBe(25 * MINUTE);
    // detenido: espera que el usuario pulse «Iniciar»
    expect(getPrimaryButtonLabel(state)).toBe('Iniciar');
  });

  it('con contador pausado distinto de 00:00 vuelve al tiempo inicial y se detiene (RF-9)', () => {
    const paused = pausedWith(7 * MINUTE);

    const state = confirmReset(paused, t0);

    expect(state.status).toBe('idle');
    expect(state.endTimestampMs).toBeNull();
    expect(state.pausedRemainingMs).toBeNull();
    expect(getRemainingMs(state, t0)).toBe(25 * MINUTE);
  });

  it('con el contador en 00:00 (venía corriendo) vuelve al tiempo inicial y arranca sola (RF-12)', () => {
    const finished = tick(start(createInitialTimerState(), t0), t0 + 25 * MINUTE);
    // sigue en 00:00 aunque pase el tiempo hasta abrir el diálogo
    const state = confirmReset(finished, t0 + 30 * MINUTE);

    expect(state.status).toBe('running');
    expect(state.endTimestampMs).toBe(t0 + 30 * MINUTE + 25 * MINUTE);
    expect(getRemainingMs(state, t0 + 30 * MINUTE)).toBe(25 * MINUTE);
  });

  it('con el contador en 00:00 y estado finished igual arranca sola (RF-12)', () => {
    const finished = finishedAt();

    const state = confirmReset(finished, t0 + 40 * MINUTE);

    expect(state.status).toBe('running');
    expect(getRemainingMs(state, t0 + 40 * MINUTE)).toBe(25 * MINUTE);
  });

  it('con running vencido que aún no pasó por tick también arranca sola (RF-12)', () => {
    const expired: TimerState = {
      status: 'running',
      durationMs: DEFAULT_STUDY_DURATION_MS,
      endTimestampMs: t0 - 1_000,
      pausedRemainingMs: null,
    };

    const state = confirmReset(expired, t0);

    expect(state.status).toBe('running');
    expect(state.endTimestampMs).toBe(t0 + 25 * MINUTE);
    expect(getRemainingMs(state, t0)).toBe(25 * MINUTE);
  });
});

describe('cancelReset', () => {
  it('devuelve exactamente el mismo estado sin ningún cambio (RF-10)', () => {
    const running = runningFrom(t0);
    const paused = pausedWith(5 * MINUTE);
    const idle = createInitialTimerState();
    const finished = finishedAt();

    expect(cancelReset(running)).toBe(running);
    expect(cancelReset(paused)).toBe(paused);
    expect(cancelReset(idle)).toBe(idle);
    expect(cancelReset(finished)).toBe(finished);
  });

  it('cancelar con la cuenta corriendo no la detiene: sigue descontando desde donde iba (RF-8, RF-10)', () => {
    const running = runningFrom(t0);

    // el diálogo se abre en t0+2 min y se cancela en t0+3 min: la cuenta siguió su marcha
    const state = cancelReset(running);

    expect(state.status).toBe('running');
    expect(getRemainingMs(state, t0 + 3 * MINUTE)).toBe(22 * MINUTE);
  });

  it('cancelar con la cuenta pausada la deja pausada en el mismo restante (RF-8, RF-10)', () => {
    const paused = pausedWith(7 * MINUTE);

    const state = cancelReset(paused);

    expect(state.status).toBe('paused');
    expect(getRemainingMs(state, t0 + 60 * MINUTE)).toBe(7 * MINUTE);
  });
});
