// Pruebas del envoltorio de notificaciones (specs 003 T6 y 004 T4). El módulo
// es un envoltorio de efectos de Expo, así que se mockea 'expo-notifications'
// para probar la lógica de programa/cancela/permisos/canal sin dispositivo.
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'id-1'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  // Spec 004, T4: canal de alarma, categoría «Detener» y descarte del aviso.
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => ({ identifier: 'phase-end', actions: [] })),
  dismissAllNotificationsAsync: jest.fn(async () => undefined),
  // Enums con los valores REALES del SDK 57 para que las comparaciones del
  // canal sean significativas (si el código usara HIGH, MAX no coincidiría).
  AndroidImportance: { NONE: 2, MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 },
  AndroidAudioUsage: { MEDIA: 1, ALARM: 4, NOTIFICATION: 5 },
  AndroidAudioContentType: { SPEECH: 1, SONIFICATION: 4 },
  AndroidNotificationVisibility: { PRIVATE: 2, PUBLIC: 1 },
}));

import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import {
  addEndOfPhaseResponseListener,
  areNotificationsEnabled,
  cancelScheduledNotifications,
  configureAlarmChannel,
  configureNotificationHandler,
  configureStopCategory,
  dismissActiveAlarm,
  openExactAlarmSettings,
  requestPermissions,
  scheduleEndOfPhaseNotification,
} from '../notifications';

const t0 = 1_700_000_000_000;
const MINUTE = 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scheduleEndOfPhaseNotification (RF-4, RF-5)', () => {
  it('programa una notificación con trigger de DATE en el fin de fase', async () => {
    const endTimestampMs = t0 + 25 * MINUTE;

    await scheduleEndOfPhaseNotification('study', endTimestampMs);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const request = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(request.trigger.type).toBe('date');
    expect(request.trigger.date).toBe(endTimestampMs);
  });

  it('usa textos en español y etiqueta la fase', async () => {
    await scheduleEndOfPhaseNotification('shortBreak', t0 + 5 * MINUTE);

    const request = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(typeof request.content.title).toBe('string');
    expect(request.content.title.length).toBeGreaterThan(0);
    expect(typeof request.content.body).toBe('string');
    expect(request.content.body.length).toBeGreaterThan(0);
    // El cuerpo menciona que es el fin de fase.
    expect(`${request.content.title} ${request.content.body}`).toMatch(/fin|termin/i);
  });

  it('programa para las tres fases (RF-5)', async () => {
    for (const phase of ['study', 'shortBreak', 'longBreak'] as const) {
      jest.clearAllMocks();
      await scheduleEndOfPhaseNotification(phase, t0 + 10 * MINUTE);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    }
  });

  it('el aviso se programa en el canal phase-alarm con la categoría phase-end (RF-2, RF-3, RF-7)', async () => {
    await scheduleEndOfPhaseNotification('study', t0 + 25 * MINUTE);

    const request = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(request.trigger.channelId).toBe('phase-alarm');
    expect(request.content.categoryIdentifier).toBe('phase-end');
  });

  it('el cuerpo identifica la fase con su etiqueta en español (RF-12)', async () => {
    await scheduleEndOfPhaseNotification('longBreak', t0 + 15 * MINUTE);

    const request = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(request.content.title).toBe('Fin de fase');
    expect(request.content.body).toContain('Descanso largo');
  });
});

describe('cancelScheduledNotifications (RF-10)', () => {
  it('cancela todos los avisos programados (pausa, reinicio, fin de fase)', async () => {
    await cancelScheduledNotifications();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('areNotificationsEnabled y requestPermissions (RF-11)', () => {
  it('areNotificationsEnabled refleja el granted del sistema', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
    expect(await areNotificationsEnabled()).toBe(true);

    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    expect(await areNotificationsEnabled()).toBe(false);
  });

  it('areNotificationsEnabled detecta el estado REAL del sistema (T10): importance > 0 cuenta como activadas', async () => {
    // Android 13+ con el interruptor de Ajustes encendido pero el permiso
    // nunca pedido (granted=false, importance=default): notificaciones ACTIVAS.
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      status: 'undetermined',
      android: { importance: 3 },
    });
    expect(await areNotificationsEnabled()).toBe(true);

    // Interruptor del sistema apagado (importance=NONE): DESACTIVADAS.
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      status: 'denied',
      android: { importance: 0 },
    });
    expect(await areNotificationsEnabled()).toBe(false);
  });

  it('requestPermissions pide permiso y devuelve si quedó concedido', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
    expect(await requestPermissions()).toBe(true);

    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    expect(await requestPermissions()).toBe(false);
  });
});

describe('configureNotificationHandler (RF-2, RF-6)', () => {
  it('el handler muestra el aviso y devuelve shouldPlaySound: true', async () => {
    configureNotificationHandler();

    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const behavior = await handler.handleNotification();

    expect(behavior).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});

describe('configureAlarmChannel (RF-2, RF-3, RF-12)', () => {
  it('crea el canal phase-alarm con importancia MAX, sonido por defecto, ALARM, vibración y visible en bloqueo', async () => {
    await configureAlarmChannel();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    const [channelId, channel] = (Notifications.setNotificationChannelAsync as jest.Mock).mock.calls[0];

    expect(channelId).toBe('phase-alarm');
    expect(channel.name).toBe('Aviso de fin de fase'); // texto en español
    expect(channel.importance).toBe(Notifications.AndroidImportance.MAX);
    expect(channel.importance).not.toBe(Notifications.AndroidImportance.HIGH);
    expect(channel.sound).toBe('default');
    expect(channel.audioAttributes.usage).toBe(Notifications.AndroidAudioUsage.ALARM);
    expect(channel.audioAttributes.contentType).toBe(Notifications.AndroidAudioContentType.SONIFICATION);
    expect(channel.vibrationPattern).toEqual([0, 500, 500, 500]);
    expect(channel.enableVibrate).toBe(true);
    expect(channel.lockscreenVisibility).toBe(Notifications.AndroidNotificationVisibility.PUBLIC);
  });
});

describe('configureStopCategory (RF-7)', () => {
  it('crea la categoría phase-end con la acción «Detener» que abre la app', async () => {
    await configureStopCategory();

    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(1);
    const [categoryIdentifier, actions] = (Notifications.setNotificationCategoryAsync as jest.Mock).mock.calls[0];

    expect(categoryIdentifier).toBe('phase-end');
    expect(actions).toHaveLength(1);
    expect(actions[0].identifier).toBe('stop');
    expect(actions[0].buttonTitle).toBe('Detener'); // texto en español
    expect(actions[0].options?.opensAppToForeground).toBe(true);
  });
});

describe('dismissActiveAlarm (RF-7)', () => {
  it('descarta el aviso activo (corta sonido y vibración)', async () => {
    await dismissActiveAlarm();

    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('addEndOfPhaseResponseListener (RF-7, RF-8)', () => {
  it('respuesta con actionIdentifier «stop»: descarta el aviso y despacha origen «detener»', async () => {
    const listener = jest.fn();
    addEndOfPhaseResponseListener(listener);
    const respuesta = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];

    await respuesta({ actionIdentifier: 'stop' });

    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ origen: 'detener' });
  });

  it('toque normal en la notificación (sin action): NO descarta y despacha origen «notificacion»', async () => {
    const listener = jest.fn();
    addEndOfPhaseResponseListener(listener);
    const respuesta = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0][0];

    await respuesta({});

    expect(Notifications.dismissAllNotificationsAsync).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith({ origen: 'notificacion' });
  });

  it('devuelve la suscripción para quitarla al desmontar (limpieza)', () => {
    const remove = jest.fn();
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValueOnce({ remove });

    const subscription = addEndOfPhaseResponseListener(jest.fn());

    expect(subscription.remove).toBe(remove);
  });
});

describe('openExactAlarmSettings (cambio 1: RF-13)', () => {
  it('abre la pantalla del sistema «Alarmas y recordatorios» con la acción exacta', async () => {
    const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);

    await openExactAlarmSettings();

    expect(sendIntent).toHaveBeenCalledTimes(1);
    expect(sendIntent).toHaveBeenCalledWith('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  });

  it('si el sistema no puede abrir la pantalla, no propaga el error (no bloquea el flujo)', async () => {
    jest.spyOn(Linking, 'sendIntent').mockRejectedValue(new Error('No activity found'));

    await expect(openExactAlarmSettings()).resolves.toBeUndefined();
  });
});
