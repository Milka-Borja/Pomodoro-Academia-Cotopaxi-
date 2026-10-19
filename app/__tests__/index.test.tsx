// Pruebas de la pantalla principal (spec 002, T9): el reloj debe avanzar
// solo con el intervalo de 250 ms —no congelarse—, la pausa debe congelarlo
// sin moverlo y la reanudación retomar; y los nuevos elementos (etiqueta de
// fase y fila de puntos) deben exponer sus valores de accesibilidad.
// Reloj virtual con fake timers. Sin dependencias nuevas:
// @testing-library/react-native ya está en devDependencies.
// En RTL v14 render es asíncronico: await render(...), y act debe vaciarse
// con await para que los updates del intervalo lleguen al árbol.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, AppState, Platform, StyleSheet } from 'react-native';

// Mock del envoltorio de AsyncStorage (spec 003, T7): la pantalla pasa a
// persistir y restaurar la sesión; sin este mock, el storage real lanza
// Invariant Violation en Jest. loadCycleState resuelve null por defecto.
// T10 (cambio 1): los dos flags de la invitación de alarmas exactas.
jest.mock('../../src/storage/cycleStorage', () => ({
  SESSION_KEY: '@pomodoro/session',
  NOTIFICATIONS_INFORMED_KEY: '@pomodoro/notif-informed',
  loadCycleState: jest.fn(async () => null),
  saveCycleState: jest.fn(async () => undefined),
  // Spec 005 (T4): la principal carga los ajustes al montar y con foco.
  SETTINGS_KEY: '@pomodoro/settings',
  loadSettings: jest.fn(async () => null),
  hasInformedNotificationsDisabled: jest.fn(async () => false),
  setNotificationsDisabledInformed: jest.fn(async () => undefined),
  hasAskedNotificationPermission: jest.fn(async () => false),
  setNotificationPermissionAsked: jest.fn(async () => undefined),
  hasSeenExactAlarmInvitation: jest.fn(async () => false),
  setExactAlarmInvitationSeen: jest.fn(async () => undefined),
  hasInformedExactAlarmRisk: jest.fn(async () => false),
  setExactAlarmRiskInformed: jest.fn(async () => undefined),
}));

// Mock del envoltorio de notificaciones (spec 003, T9): la pantalla programa
// y cancela el aviso de fin de fase; sin este mock, el envoltorio real carga
// expo-notifications (API nativa) dentro de Jest. Permiso concedido por
// DEFECTO (T6): así la mayoría de los casos usan el camino «start» del flujo
// de permiso y arrancan sin modal; los tests del flujo lo sobreescriben.
jest.mock('../../src/notifications/notifications', () => ({
  configureNotificationHandler: jest.fn(),
  configureAlarmChannel: jest.fn(async () => undefined),
  configureStopCategory: jest.fn(async () => undefined),
  scheduleEndOfPhaseNotification: jest.fn(async () => undefined),
  cancelScheduledNotifications: jest.fn(async () => undefined),
  areNotificationsEnabled: jest.fn(async () => true),
  requestPermissions: jest.fn(async () => false),
  dismissActiveAlarm: jest.fn(async () => undefined),
  addEndOfPhaseResponseListener: jest.fn(() => ({ remove: jest.fn() })),
  openExactAlarmSettings: jest.fn(async () => undefined),
}));

// Mock de expo-router (spec 005, T4): la principal recarga los ajustes al
// volver con useFocusEffect; sin mock, expo-router exige un entorno RN real.
// El callback NO se ejecuta solo en tests: el test de foco lo invoca a mano.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));

import * as cycleStorage from '../../src/storage/cycleStorage';
import * as notifications from '../../src/notifications/notifications';

import {
  DEFAULT_POMODORO_CONFIG,
  createInitialCycleState,
  detectPhaseEndWhileAway,
  startCycle,
} from '../../src/domain/cycle';
import { createInitialTimerState } from '../../src/domain/timer';
import { settingsToConfig, type PomodoroSettings } from '../../src/domain/settings';
import { router, useFocusEffect } from 'expo-router';

import IndexScreen, { cycleReducer } from '../index';

// Reloj fijo para los tests de restauración/detección (plan, sección 7).
const t0 = 1_700_000_000_000;
const MINUTE = 60 * 1000;

describe('pantalla principal (T9)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Limpieza con timers aún virtuales, para que cada test arranque con un
    // árbol fresco y sin act() superpuestos.
    cleanup();
    jest.useRealTimers();
  });

  it('el reloj avanza solo con el intervalo: Iniciar →24:59, Pausar congela y Reanudar retoma', async () => {
    await render(<IndexScreen />);
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    // El arranque pasa por el flujo de permiso (async): se drenan los microtasks.
    await act(async () => {});

    // 1 s de reloj virtual: los ticks de 250 ms deben re-renderizar el reloj.
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByLabelText('Tiempo restante: 24:59')).toBeTruthy();

    // La pausa congela el valor exacto aunque sigan pasando ticks.
    await fireEvent.press(screen.getByLabelText('Pausar'));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(screen.getByLabelText('Tiempo restante: 24:59')).toBeTruthy();

    // La reanudación continúa desde lo congelado, no desde el inicio.
    await fireEvent.press(screen.getByLabelText('Reanudar'));
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByLabelText('Tiempo restante: 24:58')).toBeTruthy();
  });

  it('expone la etiqueta de fase y la fila de puntos a la accesibilidad (RF-8, RF-9)', async () => {
    await render(<IndexScreen />);

    expect(screen.getByLabelText('Fase actual: Estudio')).toBeTruthy();
    expect(screen.getByLabelText('Pomodoros completados: 0 de 4')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();
  });
});

describe('persistencia y restauración de la sesión (T7 — RF-1, RF-2, RF-9, RF-12)', () => {
  const loadCycleState = jest.mocked(cycleStorage.loadCycleState);
  const saveCycleState = jest.mocked(cycleStorage.saveCycleState);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('restaura la sesión guardada al montar (pantalla, tiempo y contador) (RF-2)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'shortBreak',
      timer: {
        status: 'paused',
        durationMs: 5 * MINUTE,
        endTimestampMs: null,
        pausedRemainingMs: 4 * MINUTE + 32_000,
      },
      completedPomodoros: 2,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    // Vacía la cola de microtareas del load asíncrono.
    await act(async () => {});

    expect(screen.getByLabelText('Fase actual: Descanso corto')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 04:32')).toBeTruthy();
    expect(screen.getByLabelText('Pomodoros completados: 2 de 4')).toBeTruthy();
  });

  it('sin sesión guardada arranca el estado inicial y persiste al cambiar (RF-2)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(saveCycleState).toHaveBeenCalledWith(
      expect.objectContaining({
        timer: expect.objectContaining({ status: 'running' }),
      }),
    );
  });

  it('no pisa la sesión guardada con el estado inicial antes de hidratar (RF-2)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'shortBreak',
      timer: {
        status: 'paused',
        durationMs: 5 * MINUTE,
        endTimestampMs: null,
        pausedRemainingMs: 2 * MINUTE,
      },
      completedPomodoros: 1,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    await act(async () => {});

    // El estado inicial virgen (study/idle/0) jamás se escribe en storage:
    // si se escribiera antes de restaurar, se perdería la sesión del alumno.
    const esInicialVirgen = (estado: {
      phase: string;
      timer: { status: string };
      completedPomodoros: number;
    }) => estado.phase === 'study' && estado.timer.status === 'idle' && estado.completedPomodoros === 0;

    const llamadas = saveCycleState.mock.calls.map(([estado]) => estado);
    expect(llamadas.some((estado) => esInicialVirgen(estado))).toBe(false);
    expect(loadCycleState).toHaveBeenCalled();
  });

  it("AppState 'active' dispara RESUME: si la fase se cumplió lejos, queda esperando acción sin avanzar (RF-1, RF-6)", async () => {
    const listeners: Array<(state: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') {
        listeners.push(listener as (state: string) => void);
      }
      return { remove: jest.fn() };
    });

    await render(<IndexScreen />);
    await act(async () => {});

    // Estudio en marcha: fin en t0 + 25 min.
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();

    // El tiempo pasa SIN ticks (segundo plano): t0 + 30 min.
    await act(async () => {
      jest.setSystemTime(t0 + 30 * MINUTE);
    });

    // Vuelve a primer plano → RESUME detecta el fin.
    await act(async () => {
      for (const listener of listeners) {
        listener('active');
      }
    });

    // RF-6/scoping: NO avanza sola a la siguiente fase; queda en la fase
    // cumplida mostrando 00:00 (el TICK en primer plano no debe adelantarla).
    expect(screen.getByLabelText('Fase actual: Estudio')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 00:00')).toBeTruthy();
    // La sesión persistida refleja el estado detectado (awaiting).
    const ultima = saveCycleState.mock.calls.at(-1)?.[0];
    expect(ultima?.awaitingNextPhase).toBe(true);
  });

  it('no escribe en storage durante los ticks de repintado (decisión 1)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    const guardadosTrasIniciar = saveCycleState.mock.calls.length;

    // 2 s de reloj virtual: 8 ticks que SOLO repintan; nada cambia que valga
    // la pena guardar (los timestamps son la fuente de verdad).
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(saveCycleState).toHaveBeenCalledTimes(guardadosTrasIniciar);
  });
});

// Pruebas blancas del reducer: fijan la identidad del TICK, el contrato que
// permite al reloj repintarse en el dispositivo. El React Compiler memoiza
// `remaining` (Date.now() en el render) con guard en la identidad de
// state.timer: si el TICK devolviera el mismo timer, el caché serviría el
// último string y el reloj quedaría congelado (incidencia real de T7; en
// Jest no se ve porque jest-expo no compila con el React Compiler).
describe('cycleReducer (blanco): el TICK invalida el caché del compilador', () => {
  const t0 = 1_700_000_000_000;

  it('TICK sin fin de fase devuelve estado y timer NUEVOS, con los mismos campos', () => {
    const corriendo = startCycle(createInitialCycleState(), t0);
    const repintado = cycleReducer(corriendo, { type: 'TICK', now: t0 + 1_000 });

    expect(repintado).not.toBe(corriendo);
    // Identidad del timer nueva (clave para invalidar el caché del compilador)...
    expect(repintado.timer).not.toBe(corriendo.timer);
    // ...pero con los MISMOS campos: el repintado no toca la sesión.
    expect(repintado.timer).toEqual(corriendo.timer);
    expect(repintado.completedPomodoros).toBe(corriendo.completedPomodoros);
  });

  it('TICK con awaitingNextPhase también clona el timer (la fase cumplida repinta 00:00)', () => {
    const corriendo = startCycle(createInitialCycleState(), t0);
    const lejos = detectPhaseEndWhileAway(corriendo, t0 + 30 * 60 * 1000);
    expect(lejos.awaitingNextPhase).toBe(true);

    const repintado = cycleReducer(lejos, { type: 'TICK', now: t0 + 31 * 60 * 1000 });

    expect(repintado.timer).not.toBe(lejos.timer);
    expect(repintado.timer).toEqual(lejos.timer);
    // RF-6: el repintado NO avanza la fase esperada.
    expect(repintado.awaitingNextPhase).toBe(true);
  });

  it('START_NEXT desde awaiting arranca la siguiente fase; sin awaiting es identidad (RF-8, T8)', () => {
    const corriendo = startCycle(createInitialCycleState(), t0);
    const lejos = detectPhaseEndWhileAway(corriendo, t0 + 30 * MINUTE);
    expect(lejos.awaitingNextPhase).toBe(true);

    const arrancada = cycleReducer(lejos, {
      type: 'START_NEXT',
      now: t0 + 31 * MINUTE,
      config: DEFAULT_POMODORO_CONFIG,
    });

    expect(arrancada.phase).toBe('shortBreak');
    expect(arrancada.timer.status).toBe('running');
    expect(arrancada.timer.endTimestampMs).toBe(t0 + 31 * MINUTE + 5 * MINUTE);
    expect(arrancada.awaitingNextPhase).toBe(false);
    // El pomodoro se contó al DETECTAR (decisión 8): aquí no vuelve a sumar.
    expect(arrancada.completedPomodoros).toBe(1);

    // Fuera de awaiting no hay transición posible: mismo estado por identidad.
    const normal = startCycle(createInitialCycleState(), t0);
    expect(
      cycleReducer(normal, { type: 'START_NEXT', now: t0 + MINUTE, config: DEFAULT_POMODORO_CONFIG }),
    ).toBe(normal);
  });
});

describe('estado «Fase terminada» (T8 — RF-6, RF-7, RF-8)', () => {
  const loadCycleState = jest.mocked(cycleStorage.loadCycleState);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('estudio cumplido con la app cerrada: 00:00 + «Fase terminada» + «Iniciar siguiente»; al pulsarlo arranca el descanso (RF-6, RF-8)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'study',
      timer: {
        status: 'running',
        durationMs: 25 * MINUTE,
        endTimestampMs: t0 - 1_000,
        pausedRemainingMs: null,
      },
      completedPomodoros: 1,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    await act(async () => {});

    // La fase se cumplió lejos: intacta, en espera y clavada en 00:00.
    expect(screen.getByLabelText('Fase actual: Estudio')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 00:00')).toBeTruthy();
    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar siguiente')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Iniciar siguiente'));

    // Arranca la siguiente fase y la espera desaparece.
    expect(screen.getByLabelText('Fase actual: Descanso corto')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 05:00')).toBeTruthy();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(screen.queryByLabelText('Fase terminada')).toBeNull();
    expect(screen.queryByLabelText('Iniciar siguiente')).toBeNull();
  });

  it('4.º estudio cumplido lejos: fila llena (4 de 4) mientras espera; al iniciar, largo con contador a 0 (RF-7, decisión 8)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'study',
      timer: {
        status: 'running',
        durationMs: 25 * MINUTE,
        endTimestampMs: t0 - 1_000,
        pausedRemainingMs: null,
      },
      completedPomodoros: 3,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    await act(async () => {});

    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Pomodoros completados: 4 de 4')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Iniciar siguiente'));

    // Cero atómico: el descanso largo arranca con el contador ya a 0.
    expect(screen.getByLabelText('Fase actual: Descanso largo')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 15:00')).toBeTruthy();
    expect(screen.getByLabelText('Pomodoros completados: 0 de 4')).toBeTruthy();
  });
});

describe('programación del aviso de fin de fase (T9 — RF-4, RF-5, RF-10)', () => {
  const loadCycleState = jest.mocked(cycleStorage.loadCycleState);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('iniciar programa el aviso en el timestamp de fin y los ticks no lo reprograman (RF-4, RF-5)', async () => {
    await render(<IndexScreen />);
    // Al montar (fase detenida) no queda ningún aviso pendiente (RF-10).
    expect(notifications.cancelScheduledNotifications).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(notifications.scheduleEndOfPhaseNotification).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleEndOfPhaseNotification).toHaveBeenCalledWith(
      'study',
      t0 + 25 * MINUTE,
    );

    // Los repintados del intervalo (250 ms) NO re-ejecutan el efecto: las deps
    // son los campos del plan (status, fin, fase, espera), no el reloj.
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(notifications.scheduleEndOfPhaseNotification).toHaveBeenCalledTimes(1);
  });

  it('pausar cancela el aviso y reanudar lo vuelve a programar (RF-10, Escenario 4)', async () => {
    await render(<IndexScreen />);
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Pausar'));
    // Montar + pausa.
    expect(notifications.cancelScheduledNotifications).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByLabelText('Reanudar'));
    expect(notifications.scheduleEndOfPhaseNotification).toHaveBeenCalledTimes(2);
  });

  it('reiniciar cancela el aviso (RF-10)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<IndexScreen />);
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('Reiniciar'));

    // Se busca el diálogo de confirmación del reinicio por su título (el
    // informe del permiso solo puede ocurrir en el flujo del primer «Iniciar»
    // desde T6, nunca al montar).
    const reinicio = alertSpy.mock.calls.find(
      ([titulo]) => titulo === '¿Reiniciar el temporizador?',
    );
    const buttons = reinicio?.[2];
    const confirmar = buttons?.find((boton) => boton.text === 'Reiniciar');
    await act(async () => {
      confirmar?.onPress?.();
    });

    // Montar + reinicio confirmado.
    expect(notifications.cancelScheduledNotifications).toHaveBeenCalledTimes(2);
  });

  it('una fase cumplida lejos NO programa aviso: solo cancela (RF-6 + RF-10)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'study',
      timer: {
        status: 'running',
        durationMs: 25 * MINUTE,
        endTimestampMs: t0 - 1_000,
        pausedRemainingMs: null,
      },
      completedPomodoros: 1,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    await act(async () => {});

    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    // Su fin ya pasó: no hay nada que avisar, aunque el status sigue 'running'.
    expect(notifications.scheduleEndOfPhaseNotification).not.toHaveBeenCalled();
    // Montar + carga de la sesión en espera.
    expect(notifications.cancelScheduledNotifications).toHaveBeenCalledTimes(2);
  });

  it('iniciar la siguiente fase desde la espera programa el aviso de la nueva fase (RF-5)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'study',
      timer: {
        status: 'running',
        durationMs: 25 * MINUTE,
        endTimestampMs: t0 - 1_000,
        pausedRemainingMs: null,
      },
      completedPomodoros: 1,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('Iniciar siguiente'));

    expect(notifications.scheduleEndOfPhaseNotification).toHaveBeenCalledWith(
      'shortBreak',
      t0 + 5 * MINUTE,
    );
  });
});

describe('flujo de permiso del primer «Iniciar» (T6 — RF-10, RF-11)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('el chequeo de arranque de 003 ya NO está al montar: nada se informa hasta el primer «Iniciar» (RF-11)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    // El Alert de montar de 003 se unificó en el flujo del primer «Iniciar»:
    // al abrir la app no se consulta ni se informa nada (T6 elimina ese effect).
    expect(notifications.areNotificationsEnabled).not.toHaveBeenCalled();
    expect(cycleStorage.hasInformedNotificationsDisabled).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('primer «Iniciar» sin permiso: muestra la explicación y NO arranca; «Continuar» pide el permiso, informa el rechazo y arranca (RF-10, RF-11)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(false);
    jest.mocked(notifications.requestPermissions).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    // La explicación aparece y el temporizador NO arranca todavía (RF-10).
    expect(screen.getByLabelText('Continuar')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();
    expect(screen.queryByLabelText('Pausar')).toBeNull();
    // El diálogo del sistema NO se dispara solo: solo desde «Continuar».
    expect(notifications.requestPermissions).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Continuar'));
    await act(async () => {});

    // «Continuar» → solicitud al sistema UNA vez y flag de «ya pedido» (RF-10).
    expect(notifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(cycleStorage.setNotificationPermissionAsked).toHaveBeenCalledTimes(1);
    // Rechazo → informe ÚNICO con el flag de 003 y arranque igual (RF-11).
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Avisos de fin de fase no disponibles',
      'El temporizador sigue funcionando, pero no sonará ni vibrará al terminar.',
    );
    expect(cycleStorage.setNotificationsDisabledInformed).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
  });

  it('tras el rechazo, el siguiente «Iniciar» no muestra modal ni vuelve a pedir ni a informar (RF-11)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(false);
    jest.mocked(notifications.requestPermissions).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    // Primer arranque: explicación → rechazo → informe único y arranque.
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('Continuar'));
    await act(async () => {});
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    // Los setters de flags se llamaron; aquí se emula su estado persistido
    // (los mocks no comparten estado entre sí, pero AsyncStorage sí).
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(true);

    // Pausar y reiniciar (confirmado) devuelven la cuenta a «Iniciar» (idle).
    await fireEvent.press(screen.getByLabelText('Pausar'));
    await fireEvent.press(screen.getByLabelText('Reiniciar'));
    const reinicio = jest
      .mocked(Alert.alert)
      .mock.calls.find(([titulo]) => titulo === '¿Reiniciar el temporizador?');
    const confirmar = reinicio?.[2]?.find((boton) => boton.text === 'Reiniciar');
    await act(async () => {
      confirmar?.onPress?.();
    });

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    // Camino «silent»: arranca sin modal, sin solicitud y sin segundo informe.
    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(notifications.requestPermissions).toHaveBeenCalledTimes(1);
    // Solo UNA vez el informe (el otro Alert de esta prueba es la
    // confirmación nativa de «Reiniciar», que no cuenta).
    const informes = jest
      .mocked(Alert.alert)
      .mock.calls.filter(([titulo]) => titulo === 'Avisos de fin de fase no disponibles');
    expect(informes).toHaveLength(1);
    expect(cycleStorage.setNotificationsDisabledInformed).toHaveBeenCalledTimes(1);
    expect(cycleStorage.setNotificationPermissionAsked).toHaveBeenCalledTimes(1);
  });

  it('sin permiso ya pedido: informa UNA vez en el primer «Iniciar» y arranca sin modal ni solicitud (RF-11)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});
    // Nada se informa al montar: el informe ocurre dentro del flujo (T6).
    expect(Alert.alert).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Avisos de fin de fase no disponibles',
      'El temporizador sigue funcionando, pero no sonará ni vibrará al terminar.',
    );
    expect(cycleStorage.setNotificationsDisabledInformed).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
  });

  it('ya pedido e informado: arranca en silencio, sin modal, sin solicitud ni informe (RF-11)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(true);

    await render(<IndexScreen />);
    await act(async () => {});
    // El chequeo es responsabilidad del primer «Iniciar», no del montar (T6).
    expect(cycleStorage.hasInformedNotificationsDisabled).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(cycleStorage.setNotificationsDisabledInformed).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
  });

  it('con permiso concedido: el «Iniciar» arranca directo, sin modal (RF-10)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);

    await render(<IndexScreen />);
    await act(async () => {});
    // Ni siquiera se monta el modal, y el estado del permiso se consulta al
    // pulsar, no al abrir la app (T6).
    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(notifications.areNotificationsEnabled).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(notifications.areNotificationsEnabled).toHaveBeenCalledTimes(1);

    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
  });
});

describe('RF-8 — toque en el aviso de fin de fase (cierre T10)', () => {
  const saveCycleState = jest.mocked(cycleStorage.saveCycleState);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('cablea el listener de respuesta al montar y lo quita al desmontar', async () => {
    const remove = jest.fn();
    jest.mocked(notifications.addEndOfPhaseResponseListener).mockReturnValue({ remove });

    const { unmount } = await render(<IndexScreen />);
    await act(async () => {});

    expect(notifications.addEndOfPhaseResponseListener).toHaveBeenCalledTimes(1);

    // RTL v14: unmount es asíncronico (la limpieza de efectos corre después).
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('al tocar el aviso, la fase cumplida se muestra como «Fase terminada» con «Iniciar siguiente»', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    const toque = jest.mocked(notifications.addEndOfPhaseResponseListener).mock.calls[0][0];

    // El fin de fase ocurre mientras la app está en segundo plano (sin ticks).
    await act(async () => {
      jest.setSystemTime(t0 + 30 * MINUTE);
    });

    // El usuario toca el aviso: el listener reevalúa el ciclo al instante.
    // El wrapper entrega el origen (spec 004, T4); esta pantalla aún lo ignora.
    await act(async () => {
      toque({ origen: 'notificacion' });
    });

    expect(screen.getByLabelText('Fase actual: Estudio')).toBeTruthy();
    expect(screen.getByLabelText('Tiempo restante: 00:00')).toBeTruthy();
    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar siguiente')).toBeTruthy();
    // La sesión persistida refleja la espera detectada por el toque.
    const ultima = saveCycleState.mock.calls.at(-1)?.[0];
    expect(ultima?.awaitingNextPhase).toBe(true);
  });
});

describe('vista de alarma en primer plano (T7 — RF-6, RF-7, RF-8)', () => {
  const loadCycleState = jest.mocked(cycleStorage.loadCycleState);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('la fase terminada EN primer plano muestra «Fase terminada», «Iniciar siguiente» y la vista de alarma (RF-6)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    // Ticks del intervalo hasta el fin de la fase (25 min) + 1 s de margen.
    await act(async () => {
      jest.advanceTimersByTime(25 * MINUTE + 1_000);
    });

    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar siguiente')).toBeTruthy();
    // La vista de alarma (componente de T5) se levanta sobre la pantalla.
    expect(screen.getByLabelText('Detener aviso')).toBeTruthy();
    expect(screen.getByLabelText('Fase cumplida: Estudio')).toBeTruthy();
  });

  it('«Detener» cierra la vista de alarma y llama a dismissActiveAlarm (RF-7)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(25 * MINUTE + 1_000);
    });

    await fireEvent.press(screen.getByLabelText('Detener aviso'));
    await act(async () => {});

    expect(notifications.dismissActiveAlarm).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Detener aviso')).toBeNull();
    // Debajo queda la fase terminada con su botón (mismo resultado que RF-8).
    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar siguiente')).toBeTruthy();
  });

  it('abrir desde el aviso (toque y «Detener») muestra «Fase terminada» SIN vista de alarma (RF-8, RF-7)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    // El reloj corre en primer plano (la bandera de alarma queda armada)…
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    const respuesta = jest.mocked(
      notifications.addEndOfPhaseResponseListener,
    ).mock.calls[0][0];

    // …y la fase se cumple fuera, sin ticks: el aviso se atiende fuera.
    await act(async () => {
      jest.setSystemTime(t0 + 30 * MINUTE);
    });
    await act(async () => {
      respuesta({ origen: 'notificacion' });
    });

    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar siguiente')).toBeTruthy();
    expect(screen.queryByLabelText('Detener aviso')).toBeNull();

    // «Detener» desde la notificación: mismo resultado unificado (RF-7).
    await act(async () => {
      respuesta({ origen: 'detener' });
    });
    expect(screen.queryByLabelText('Detener aviso')).toBeNull();
  });

  it('reabrir la app con la fase ya terminada NO muestra la alarma (decisión 8)', async () => {
    loadCycleState.mockResolvedValueOnce({
      phase: 'study',
      timer: {
        status: 'running',
        durationMs: 25 * MINUTE,
        endTimestampMs: t0 - 1_000,
        pausedRemainingMs: null,
      },
      completedPomodoros: 1,
      awaitingNextPhase: false,
    });

    await render(<IndexScreen />);
    await act(async () => {});

    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar siguiente')).toBeTruthy();
    expect(screen.queryByLabelText('Detener aviso')).toBeNull();
  });

  it('volver de segundo plano tras el fin de fase NO levanta la alarma (decisión 8)', async () => {
    const listeners: Array<(state: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') {
        listeners.push(listener as (state: string) => void);
      }
      return { remove: jest.fn() };
    });

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    // Armada mientras la app estuvo en pantalla…
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });

    // …la app sale de pantalla y la fase se cumple fuera (sin ticks)…
    await act(async () => {
      jest.setSystemTime(t0 + 30 * MINUTE);
      for (const listener of listeners) {
        listener('background');
      }
    });
    // …y el usuario vuelve sin tocar el aviso.
    await act(async () => {
      for (const listener of listeners) {
        listener('active');
      }
    });

    expect(screen.getByLabelText('Fase terminada')).toBeTruthy();
    expect(screen.queryByLabelText('Detener aviso')).toBeNull();
  });
});

// Invitación única a «Alarmas y recordatorios» (spec 004, T10, cambio 1:
// RF-13, RF-14). El preset de Jest de React Native arranca en 'ios' (nota del
// plan §7): los casos de invitación fijan Android ≥ 31 en beforeEach y lo
// restauran en afterEach; los de «sin invitación» cambian plataforma/versión.
describe('invitación a «Alarmas y recordatorios» (T10 — RF-13, RF-14)', () => {
  // El Platform de React Native expone `OS` como dato pero `Version` como
  // GETTER de solo lectura (`Platform.ios.js`): `Platform.Version = 31` no
  // surte efecto y la matriz resolvería 'silent' (sin invitación) en Android.
  // Se redefine el descriptor con defineProperty y se restaura el original.
  const descriptorOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const descriptorVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');

  const fijarPlataforma = (os: typeof Platform.OS, version: number) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      writable: true,
      configurable: true,
      enumerable: descriptorOs?.enumerable ?? true,
    });
    Object.defineProperty(Platform, 'Version', {
      value: version,
      writable: true,
      configurable: true,
      enumerable: descriptorVersion?.enumerable ?? true,
    });
  };

  const restaurarPlataforma = () => {
    if (descriptorOs) {
      Object.defineProperty(Platform, 'OS', descriptorOs);
    }
    if (descriptorVersion) {
      Object.defineProperty(Platform, 'Version', descriptorVersion);
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
    fijarPlataforma('android', 31);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
    restaurarPlataforma();
  });

  it('primer «Iniciar» con notificaciones concedidas y sin invitar: muestra la invitación y NO arranca hasta elegir (RF-13)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    // El modal de invitación aparece con sus dos acciones…
    expect(screen.getByLabelText('Abrir ajustes')).toBeTruthy();
    expect(screen.getByLabelText('Ahora no')).toBeTruthy();
    // …y el temporizador NO arranca hasta elegir (RF-13: ninguna acción bloquea).
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();
    expect(screen.queryByLabelText('Pausar')).toBeNull();
    // Ninguna acción se ejecutó todavía.
    expect(cycleStorage.setExactAlarmInvitationSeen).not.toHaveBeenCalled();
    expect(notifications.openExactAlarmSettings).not.toHaveBeenCalled();
  });

  it('«Abrir ajustes» arranca la sesión, abre la pantalla del sistema y persiste los dos flags (RF-13)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Abrir ajustes'));
    await act(async () => {});

    // La sesión arranca ANTES de irse a Ajustes: nunca se bloquea (RF-13).
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();
    // Los dos flags quedan guardados: nunca más invitación ni informe (RF-14).
    expect(cycleStorage.setExactAlarmInvitationSeen).toHaveBeenCalledTimes(1);
    expect(cycleStorage.setExactAlarmRiskInformed).toHaveBeenCalledTimes(1);
    // Se abre la pantalla «Alarmas y recordatorios» del sistema.
    expect(notifications.openExactAlarmSettings).toHaveBeenCalledTimes(1);
    // Sin informe en este camino: la pantalla del sistema es la elección.
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('«Ahora no» marca la invitación, informa UNA vez con su flag y arranca (RF-14)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Ahora no'));
    await act(async () => {});

    // El flag de «ya invitado» se marca (así no se vuelve a invitar aunque la
    // app se cierre entre los dos flags)…
    expect(cycleStorage.setExactAlarmInvitationSeen).toHaveBeenCalledTimes(1);
    // …el riesgo se informa UNA sola vez con su flag…
    expect(cycleStorage.setExactAlarmRiskInformed).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'El aviso puede no ser puntual',
      'Sin «Alarmas y recordatorios» el aviso puede llegar tarde o no llegar a la hora exacta. El temporizador sigue funcionando.',
    );
    // …y la sesión arranca: «Ahora no» no bloquea el temporizador (RF-14).
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(screen.queryByLabelText('Ahora no')).toBeNull();
    // Sin pantalla de ajustes en este camino.
    expect(notifications.openExactAlarmSettings).not.toHaveBeenCalled();
  });

  it('segunda sesión (ya invitado e informado): arranca sin invitación ni informe (RF-14)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(true);

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(cycleStorage.setExactAlarmInvitationSeen).not.toHaveBeenCalled();
  });

  it('en iOS no existe la invitación: arranca directo (RF-13)', async () => {
    Platform.OS = 'ios';
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(cycleStorage.setExactAlarmInvitationSeen).not.toHaveBeenCalled();
  });

  it('en Android < 12 (versión 30) no existe la invitación: arranca directo (RF-13)', async () => {
    Platform.Version = 30;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(cycleStorage.setExactAlarmInvitationSeen).not.toHaveBeenCalled();
  });

  it('sin notificaciones no se invita: manda RF-11 y arranca sin modal (RF-13, caso límite)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(true);

    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});

    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(cycleStorage.setExactAlarmInvitationSeen).not.toHaveBeenCalled();
  });

  it('cadena: explicación de permisos → «Continuar» concedido → invitación → arranque (RF-10, RF-13)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(notifications.areNotificationsEnabled).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasAskedNotificationPermission).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedNotificationsDisabled).mockResolvedValue(false);
    jest.mocked(notifications.requestPermissions).mockResolvedValue(true);
    jest.mocked(cycleStorage.hasSeenExactAlarmInvitation).mockResolvedValue(false);
    jest.mocked(cycleStorage.hasInformedExactAlarmRisk).mockResolvedValue(false);

    await render(<IndexScreen />);
    await act(async () => {});

    // Primer «Iniciar»: la explicación de permisos, sin invitación todavía.
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    expect(screen.getByLabelText('Continuar')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();

    // «Continuar» concede → la cadena llega a la invitación (sin arrancar aún).
    await fireEvent.press(screen.getByLabelText('Continuar'));
    await act(async () => {});
    expect(notifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Continuar')).toBeNull();
    expect(screen.getByLabelText('Abrir ajustes')).toBeTruthy();
    expect(screen.queryByLabelText('Pausar')).toBeNull();

    // Elegir una acción arranca la sesión (RF-13: nunca se bloquea).
    await fireEvent.press(screen.getByLabelText('Ahora no'));
    await act(async () => {});
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir ajustes')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Spec 005 (T4): los ajustes llegan a la pantalla principal. La hidratación
// carga sesión y ajustes en paralelo; el foco los recarga al volver desde
// Ajustes; las transiciones reciben el config vigente.
// ---------------------------------------------------------------------------
describe('ajustes en la principal (spec 005, T4 — RF-1, RF-6, RF-7, RF-8)', () => {
  const loadSettings = jest.mocked(cycleStorage.loadSettings);
  const saveCycleState = jest.mocked(cycleStorage.saveCycleState);

  const AJUSTES_40: PomodoroSettings = {
    studyMinutes: 40,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    pomodorosPerCycle: 2,
  };
  const CONFIG_40 = settingsToConfig(AJUSTES_40);

  // Último callback registrado por useFocusEffect: el mock no lo ejecuta solo,
  // el test lo invoca a mano para simular el retorno desde Ajustes.
  const ultimoFoco = () => {
    const calls = jest.mocked(useFocusEffect).mock.calls;
    return calls[calls.length - 1]?.[0];
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('al montar con ajustes de 40 min / 2 pomodoros pinta 40:00 y «0 de 2» (RF-1, RF-8)', async () => {
    loadSettings.mockResolvedValueOnce(AJUSTES_40);

    await render(<IndexScreen />);
    await act(async () => {});

    expect(screen.getByLabelText('Tiempo restante: 40:00')).toBeTruthy();
    const fila = screen.getByLabelText('Pomodoros completados: 0 de 2');
    // La fila se pinta con el tamaño de ciclo guardado: 2 casilleros.
    expect((fila.props.children as unknown[]).length).toBe(2);
  });

  it('APPLY_SETTINGS sobre una fase corriendo deja los timestamps intactos (RF-7)', () => {
    const corriendo = startCycle(createInitialCycleState(), t0);

    const aplicado = cycleReducer(corriendo, { type: 'APPLY_SETTINGS', config: CONFIG_40 });

    // Identidad: una fase iniciada no cambia (el reloj no salta ni retrocede).
    expect(aplicado).toBe(corriendo);
    expect(aplicado.timer.endTimestampMs).toBe(corriendo.timer.endTimestampMs);
  });

  it('APPLY_SETTINGS sobre una fase detenida cambia su duración y conserva el contador (RF-7)', () => {
    const detenida = { ...createInitialCycleState(), completedPomodoros: 2 };

    const aplicado = cycleReducer(detenida, { type: 'APPLY_SETTINGS', config: CONFIG_40 });

    expect(aplicado.timer.status).toBe('idle');
    expect(aplicado.timer.durationMs).toBe(40 * MINUTE);
    expect(aplicado.completedPomodoros).toBe(2);
  });

  it('START_NEXT arranca la siguiente fase con el config vigente (RF-1, RF-8)', () => {
    const corriendo = startCycle(createInitialCycleState(), t0);
    const lejos = detectPhaseEndWhileAway(corriendo, t0 + 30 * MINUTE);

    const arrancada = cycleReducer(lejos, {
      type: 'START_NEXT',
      now: t0 + 31 * MINUTE,
      config: CONFIG_40,
    });

    expect(arrancada.phase).toBe('shortBreak');
    expect(arrancada.timer.durationMs).toBe(10 * MINUTE);
    expect(arrancada.timer.endTimestampMs).toBe(t0 + 31 * MINUTE + 10 * MINUTE);
    expect(arrancada.completedPomodoros).toBe(1);
  });

  it('CONFIRM_RESET reinicia la fase con el config vigente y el contador intacto (RF-1)', () => {
    const enLargo = startCycle(
      {
        ...createInitialCycleState(),
        phase: 'longBreak',
        timer: createInitialTimerState(15 * MINUTE),
      },
      t0,
    );

    const reiniciado = cycleReducer(enLargo, { type: 'CONFIRM_RESET', config: CONFIG_40 });

    expect(reiniciado.timer.status).toBe('idle');
    expect(reiniciado.timer.durationMs).toBe(20 * MINUTE); // largo del config, no 15
    expect(reiniciado.completedPomodoros).toBe(0);
  });

  it('al volver del foco SIN cambios: identidad y sin escrituras extra (RF-6)', async () => {
    await render(<IndexScreen />);
    await act(async () => {}); // hidratación (persiste una vez al hidratar)

    const escriturasTrasMontar = saveCycleState.mock.calls.length;

    const foco = ultimoFoco();
    expect(foco).toBeDefined();
    await act(async () => {
      foco?.();
    });
    await act(async () => {});

    // Ajustes iguales → APPLY_SETTINGS es identidad y no se vuelve a escribir.
    expect(saveCycleState.mock.calls.length).toBe(escriturasTrasMontar);
    expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();
    expect(screen.getByLabelText('Pomodoros completados: 0 de 4')).toBeTruthy();
  });

  it('al volver del foco CON ajustes distintos los aplica a la fase detenida (RF-1)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    loadSettings.mockResolvedValueOnce(AJUSTES_40);

    const foco = ultimoFoco();
    await act(async () => {
      foco?.();
    });
    await act(async () => {});

    expect(screen.getByLabelText('Tiempo restante: 40:00')).toBeTruthy();
    expect(screen.getByLabelText('Pomodoros completados: 0 de 2')).toBeTruthy();
  });
});

describe('engranaje de la cabecera (spec 005, T7 — RF-5)', () => {
  const push = jest.mocked(router.push);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(t0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('es un botón accesible: rol, etiqueta, área táctil ≥ 44 px y glifo monócromo', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    const engranaje = screen.getByLabelText('Ajustes');
    expect(engranaje.props.accessibilityRole).toBe('button');
    // Área táctil ≥ 44 px con padding + hitSlop (rn-conventions).
    expect(engranaje.props.hitSlop).toBeTruthy();
    const estilo = StyleSheet.flatten(
      engranaje.props.style as Parameters<typeof StyleSheet.flatten>[0],
    ) as { minHeight?: number; minWidth?: number } | undefined;
    expect(estilo?.minHeight).toBeGreaterThanOrEqual(44);
    expect(estilo?.minWidth).toBeGreaterThanOrEqual(44);
    // Glifo ⚙ (U+2699) con selector de variante de texto (U+FE0E): el
    // monócromo que exige el plan §6.6 (sin librerías nuevas).
    expect(screen.getByText('⚙︎')).toBeTruthy();
  });

  it('al pulsarlo abre Ajustes con router.push("/settings") (RF-5)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Ajustes'));
    await act(async () => {});

    expect(push).toHaveBeenCalledWith('/settings');
  });
});
