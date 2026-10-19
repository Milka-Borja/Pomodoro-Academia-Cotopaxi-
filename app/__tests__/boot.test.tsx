// Pruebas de arranque offline (spec 006, T4; RF-1, RF-2, RF-9): el primer
// arranque va directo al temporizador y un almacén ilegible se descarta en
// silencio aplicando los defaults 25/5/15/4, sin diálogo y sin bloquear el uso.
//
// A DIFERENCIA de index.test.tsx (que mockea cycleStorage entero), aquí se
// usa el envoltorio REAL con el mock oficial de AsyncStorage: lo que se ejercita
// es justo el path completo getItem → codec → null → DEFAULT_SETTINGS hasta la
// pantalla (decisión técnica 4 del plan). Solo se mockea lo de convención:
// notifications (API nativa) y expo-router (exige entorno RN real).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EXACT_ALARM_INFORMED_KEY,
  EXACT_ALARM_INVITED_KEY,
  NOTIFICATIONS_INFORMED_KEY,
  PERMISSION_ASKED_KEY,
  SESSION_KEY,
  SETTINGS_KEY,
} from '../../src/storage/cycleStorage';

import IndexScreen from '../index';

// Textos que NUNCA deben existir en la app sin registro (RF-1, RF-2): si
// aparece pantalla o mensaje de cuenta, la prueba delata el registro.
const TEXTOS_PROHIBIDOS: readonly RegExp[] = [
  /cuenta/i,
  /registr/i,
  /iniciar sesión/i,
  /login/i,
  /correo/i,
  /contraseña/i,
];

function expectSinPantallaDeCuenta() {
  for (const texto of TEXTOS_PROHIBIDOS) {
    expect(screen.queryByText(texto)).toBeNull();
  }
}

function expectTemporizadorPorDefecto() {
  // Defaults de la técnica (25/5/15/4, skill pomodoro-rules vía spec 005).
  expect(screen.getByLabelText('Tiempo restante: 25:00')).toBeTruthy();
  expect(screen.getByLabelText('Fase actual: Estudio')).toBeTruthy();
  expect(screen.getByLabelText('Pomodoros completados: 0 de 4')).toBeTruthy();
}

describe('arranque offline (T4 — RF-1, RF-2, RF-9)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('primer arranque con almacén vacío: directo al temporizador con defaults, sin diálogo ni pantalla de cuenta', async () => {
    await AsyncStorage.clear();

    await render(<IndexScreen />);
    // Vacía la cola de microtareas de la hidratación asíncrona (loadCycleState
    // + loadSettings en paralelo).
    await act(async () => {});

    expectTemporizadorPorDefecto();
    expectSinPantallaDeCuenta();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('datos ilegibles en las 6 claves: descarte silencioso, defaults 25/5/15/4, sin diálogo y sin bloqueo (RF-9)', async () => {
    await AsyncStorage.clear();
    // Basura en TODO lo guardado: sesión y ajustes corruptos + flags con
    // contenido que no significa nada ('25' y '[1,2]' no son booleanos).
    await AsyncStorage.setItem(SESSION_KEY, '{ corrupto');
    await AsyncStorage.setItem(SETTINGS_KEY, '25');
    await AsyncStorage.setItem(NOTIFICATIONS_INFORMED_KEY, '[1,2]');
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '{ corrupto');
    await AsyncStorage.setItem(EXACT_ALARM_INVITED_KEY, '25');
    await AsyncStorage.setItem(EXACT_ALARM_INFORMED_KEY, '[1,2]');

    await render(<IndexScreen />);
    await act(async () => {});

    expectTemporizadorPorDefecto();
    expectSinPantallaDeCuenta();
    // Sin diálogo ni pantalla de error: el descarte es silencioso (RF-9).
    expect(Alert.alert).not.toHaveBeenCalled();

    // Nada bloquea el uso: el reloj arranca y cuenta desde el default.
    await fireEvent.press(screen.getByLabelText('Iniciar'));
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByLabelText('Tiempo restante: 24:59')).toBeTruthy();
  });
});
