// Pruebas del envoltorio de AsyncStorage (specs 003, T5 y 004, T3). Usa el mock oficial
// de @react-native-async-storage/async-storage (jest-expo lo reexporta).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_STUDY_DURATION_MS, type TimerState } from '../../domain/timer';
import type { CycleState } from '../../domain/cycle';
import type { PomodoroSettings } from '../../domain/settings';
import {
  EXACT_ALARM_INFORMED_KEY,
  EXACT_ALARM_INVITED_KEY,
  NOTIFICATIONS_INFORMED_KEY,
  PERMISSION_ASKED_KEY,
  SESSION_KEY,
  SETTINGS_KEY,
  hasAskedNotificationPermission,
  hasInformedExactAlarmRisk,
  hasInformedNotificationsDisabled,
  hasSeenExactAlarmInvitation,
  loadCycleState,
  loadSettings,
  saveCycleState,
  saveSettings,
  setExactAlarmInvitationSeen,
  setExactAlarmRiskInformed,
  setNotificationPermissionAsked,
  setNotificationsDisabledInformed,
} from '../cycleStorage';

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

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('cycleStorage — guardar y cargar la sesión (RF-1, RF-2, RF-12)', () => {
  it('saveCycleState y luego loadCycleState devuelve el mismo estado', async () => {
    const state = makeState({ awaitingNextPhase: true, completedPomodoros: 3 });

    await saveCycleState(state);
    const loaded = await loadCycleState();

    expect(loaded).toEqual(state);
  });

  it('loadCycleState sin sesión guardada → null', async () => {
    expect(await loadCycleState()).toBeNull();
  });

  it('loadCycleState con JSON corrupto → null (no lanza)', async () => {
    await AsyncStorage.setItem(SESSION_KEY, '{ corrupto');

    expect(await loadCycleState()).toBeNull();
  });

  it('usar la clave de sesión constante (@pomodoro/session)', async () => {
    const state = makeState();
    await saveCycleState(state);

    const raw = await AsyncStorage.getItem(SESSION_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(state);
  });
});

describe('cycleStorage — flag «ya se informó de notificaciones desactivadas» (RF-11)', () => {
  it('hasInformed empieza en false cuando no hay nada guardado', async () => {
    expect(await hasInformedNotificationsDisabled()).toBe(false);
  });

  it('setNotificationsDisabledInformed deja el flag en true y persiste', async () => {
    await setNotificationsDisabledInformed();

    expect(await hasInformedNotificationsDisabled()).toBe(true);
    expect(await AsyncStorage.getItem(NOTIFICATIONS_INFORMED_KEY)).not.toBeNull();
  });

  it('tras setNotificationsDisabledInformed, hasInformed sigue en true tras recargar', async () => {
    await setNotificationsDisabledInformed();
    // Simula un nuevo arranque leyendo de nuevo desde AsyncStorage.
    expect(await hasInformedNotificationsDisabled()).toBe(true);
  });

  it('el flag usa una clave distinta a la de la sesión', () => {
    expect(NOTIFICATIONS_INFORMED_KEY).not.toBe(SESSION_KEY);
  });

  it('el formato del flag no cambia: se guarda exactamente «true» bajo @pomodoro/notif-informed (RF-11)', async () => {
    await setNotificationsDisabledInformed();

    expect(NOTIFICATIONS_INFORMED_KEY).toBe('@pomodoro/notif-informed');
    expect(await AsyncStorage.getItem(NOTIFICATIONS_INFORMED_KEY)).toBe('true');
  });
});

describe('cycleStorage — flag «ya se pidió el permiso» (RF-10, RF-11)', () => {
  it('hasAskedNotificationPermission devuelve false cuando no hay nada guardado', async () => {
    expect(await hasAskedNotificationPermission()).toBe(false);
  });

  it('setNotificationPermissionAsked deja el flag en true y persiste', async () => {
    await setNotificationPermissionAsked();

    expect(await hasAskedNotificationPermission()).toBe(true);
    expect(await AsyncStorage.getItem(PERMISSION_ASKED_KEY)).not.toBeNull();
  });

  it('tras setNotificationPermissionAsked, el getter sigue en true al releer (nuevo arranque)', async () => {
    await setNotificationPermissionAsked();

    // Simula un nuevo arranque leyendo de nuevo desde AsyncStorage.
    expect(await hasAskedNotificationPermission()).toBe(true);
  });

  it('usa la clave exacta @pomodoro/permission-asked, distinta de la sesión y del flag de informado', async () => {
    expect(PERMISSION_ASKED_KEY).toBe('@pomodoro/permission-asked');
    expect(PERMISSION_ASKED_KEY).not.toBe(SESSION_KEY);
    expect(PERMISSION_ASKED_KEY).not.toBe(NOTIFICATIONS_INFORMED_KEY);

    await setNotificationPermissionAsked();

    // Pedir el permiso NO marca como informado: son flags independientes (RF-10 vs RF-11).
    expect(await hasInformedNotificationsDisabled()).toBe(false);
    expect(await AsyncStorage.getItem(NOTIFICATIONS_INFORMED_KEY)).toBeNull();
  });

  it('informar una vez NO marca como pedido: los dos flags no se pisan', async () => {
    await setNotificationsDisabledInformed();

    expect(await hasAskedNotificationPermission()).toBe(false);
    expect(await AsyncStorage.getItem(PERMISSION_ASKED_KEY)).toBeNull();
  });
});

describe('cycleStorage — flags de alarmas exactas (cambio 1: RF-13, RF-14)', () => {
  it('ambos getters empiezan en false cuando no hay nada guardado', async () => {
    expect(await hasSeenExactAlarmInvitation()).toBe(false);
    expect(await hasInformedExactAlarmRisk()).toBe(false);
  });

  it('setExactAlarmInvitationSeen deja el flag en true con la clave exacta @pomodoro/exact-alarm-invited', async () => {
    await setExactAlarmInvitationSeen();

    expect(await hasSeenExactAlarmInvitation()).toBe(true);
    expect(EXACT_ALARM_INVITED_KEY).toBe('@pomodoro/exact-alarm-invited');
    expect(await AsyncStorage.getItem(EXACT_ALARM_INVITED_KEY)).toBe('true');
    // Invitar NO informa: los dos flags son independientes (RF-13 vs RF-14).
    expect(await hasInformedExactAlarmRisk()).toBe(false);
  });

  it('setExactAlarmRiskInformed deja el flag en true con la clave exacta @pomodoro/exact-alarm-informed', async () => {
    await setExactAlarmRiskInformed();

    expect(await hasInformedExactAlarmRisk()).toBe(true);
    expect(EXACT_ALARM_INFORMED_KEY).toBe('@pomodoro/exact-alarm-informed');
    expect(await AsyncStorage.getItem(EXACT_ALARM_INFORMED_KEY)).toBe('true');
    // Informar NO invita: los dos flags no se pisan.
    expect(await hasSeenExactAlarmInvitation()).toBe(false);
  });

  it('los flags persisten al releer (nuevo arranque) y no pisan ni la sesión ni los flags de 003', async () => {
    await setExactAlarmInvitationSeen();
    await setExactAlarmRiskInformed();

    expect(await hasSeenExactAlarmInvitation()).toBe(true);
    expect(await hasInformedExactAlarmRisk()).toBe(true);
    expect(EXACT_ALARM_INVITED_KEY).not.toBe(SESSION_KEY);
    expect(EXACT_ALARM_INVITED_KEY).not.toBe(PERMISSION_ASKED_KEY);
    expect(EXACT_ALARM_INFORMED_KEY).not.toBe(NOTIFICATIONS_INFORMED_KEY);
    expect(await hasAskedNotificationPermission()).toBe(false);
    expect(await hasInformedNotificationsDisabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Spec 005 (T3): persistencia de los ajustes bajo clave propia.
// ---------------------------------------------------------------------------
describe('cycleStorage — ajustes del ciclo (spec 005, RF-2)', () => {
  const ajustes: PomodoroSettings = {
    studyMinutes: 40,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    pomodorosPerCycle: 2,
  };

  it('loadSettings sin nada guardado → null', async () => {
    expect(await loadSettings()).toBeNull();
  });

  it('tras saveSettings → devuelve el mismo valor', async () => {
    await saveSettings(ajustes);

    expect(await loadSettings()).toEqual(ajustes);
  });

  it('usa la clave exacta @pomodoro/settings, distinta de la de la sesión', async () => {
    expect(SETTINGS_KEY).toBe('@pomodoro/settings');
    expect(SETTINGS_KEY).not.toBe(SESSION_KEY);

    await saveSettings(ajustes);

    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(ajustes);
  });

  it('guardar ajustes no cambia el formato de @pomodoro/session (RF-2)', async () => {
    const state = makeState();
    await saveCycleState(state);
    await saveSettings(ajustes);

    expect(await AsyncStorage.getItem(SESSION_KEY)).toBe(JSON.stringify(state));
    expect(await loadCycleState()).toEqual(state);
    expect(await loadSettings()).toEqual(ajustes);
  });

  it('loadSettings con JSON corrupto → null (no lanza)', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, '{ corrupto');

    expect(await loadSettings()).toBeNull();
  });

  it('loadSettings con dato fuera de rango → null (el codec rechaza)', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...ajustes, studyMinutes: 70 }),
    );

    expect(await loadSettings()).toBeNull();
  });

  it('el error de escritura se traga: saveSettings no lanza (mejor esfuerzo)', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disco lleno'));

    await expect(saveSettings(ajustes)).resolves.toBeUndefined();

    spy.mockRestore();
  });

  it('el error de lectura se traga: loadSettings → null (no lanza)', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('disco lleno'));

    expect(await loadSettings()).toBeNull();

    spy.mockRestore();
  });
});
