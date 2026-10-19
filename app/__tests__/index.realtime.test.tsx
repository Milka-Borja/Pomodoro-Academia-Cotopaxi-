// Reproducción de la falla reportada en dispositivo (T7): «el reloj se congela
// tras Iniciar». Con timers REALES (como en Expo Go): render, Iniciar y esperar
// ~1,3 s de reloj real para que los ticks de 250 ms repinten. Si el display no
// refresca, aquí fallará también.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';

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
  // T10 (cambio 1): la cadena de arranque lee los flags de alarmas exactas;
  // sin ellos en el mock, startFromIdle rechazaría y el reloj no arrancaría.
  hasSeenExactAlarmInvitation: jest.fn(async () => false),
  setExactAlarmInvitationSeen: jest.fn(async () => undefined),
  hasInformedExactAlarmRisk: jest.fn(async () => false),
  setExactAlarmRiskInformed: jest.fn(async () => undefined),
}));

// Mock del envoltorio de notificaciones (spec 003, T9): la pantalla lo usa
// para programar/cancelar el aviso; sin este mock, el envoltorio real carga
// expo-notifications (API nativa) dentro de Jest.
jest.mock('../../src/notifications/notifications', () => ({
  configureNotificationHandler: jest.fn(),
  configureAlarmChannel: jest.fn(async () => undefined),
  configureStopCategory: jest.fn(async () => undefined),
  scheduleEndOfPhaseNotification: jest.fn(async () => undefined),
  cancelScheduledNotifications: jest.fn(async () => undefined),
  addEndOfPhaseResponseListener: jest.fn(() => ({ remove: jest.fn() })),
  dismissActiveAlarm: jest.fn(async () => undefined),
  openExactAlarmSettings: jest.fn(async () => undefined),
  // Permiso concedido para que el aviso único de RF-11 (T10) no intervenga
  // en esta regresión del reloj.
  areNotificationsEnabled: jest.fn(async () => true),
}));

// Mock de expo-router (spec 005, T4): la principal recarga los ajustes con
// useFocusEffect; en esta regresión el callback no se invoca, solo hace
// falta el mock para que el import no caiga al entorno real.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));

import IndexScreen from '../index';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('reloj con timers reales (reproducción de la falla en dispositivo)', () => {
  afterEach(cleanup);

  it('tras Iniciar, el reloj sigue bajando con el intervalo (25:00 → ≤24:59 en ~1,3 s)', async () => {
    await render(<IndexScreen />);
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText('Iniciar'));

    // Al instante puede leer 25:00 o 24:59 (floor de segundos): capturamos y
    // esperamos 1,3 s reales para comprobar que el refresco NO se congela.
    const initial = screen.getByLabelText(/^Tiempo restante: /).props.accessibilityLabel;

    await act(async () => {
      await sleep(1_300);
    });

    const label = screen.getByLabelText(/^Tiempo restante: /).props.accessibilityLabel;
    const shown = label.replace('Tiempo restante: ', '');
    // Tras 1,3 s reales debe haber repintado por debajo del valor inicial.
    expect(initial).not.toBe(label);
    expect(['24:58', '24:57']).toContain(shown);
  });
});
