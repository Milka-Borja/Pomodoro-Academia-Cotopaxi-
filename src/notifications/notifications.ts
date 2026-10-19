// Envoltorio de notificaciones de fase (spec 003, T6). Módulo con EFECTOS:
// es el único punto (junto con cycleStorage.ts) que toca APIs con side-effects
// fuera de src/domain (principio 3: la lógica pura vive en src/domain).
//
// - RF-4/RF-5: al iniciar cada fase se programa un aviso de fin de fase con un
//   trigger de TIMESTAMP (DATE) en endTimestampMs: la notificación local la
//   dispara el sistema operativo aunque la app esté cerrada (decisión 8: solo
//   expo-notifications, sin expo-task-manager; los triggers locales de fecha no
//   necesitan tarea en segundo plano).
// - RF-10: cancelScheduledNotifications se llama desde el useEffect de la
//   pantalla en pausa/reinicio/fin, de modo que en pausa no hay ningún aviso.
// - RF-11: areNotificationsEnabled/requestPermissions permiten degradar en
//   silencio y mostrar el aviso único.
// - RF-8: addEndOfPhaseResponseListener detecta el toque en el aviso.
// - Spec 004, T4: canal de alarma Android «phase-alarm» (importancia máxima,
//   sonido por defecto en stream de ALARM, vibración y visible en la pantalla
//   de bloqueo: RF-2, RF-3, RF-12), handler con sonido (RF-2), categoría
//   «phase-end» con la acción «Detener» (RF-7), aviso programado en ese canal
//   y dismissActiveAlarm() para cortar el aviso activo (RF-7, RF-8).
// - Spec 004, cambio 1: openExactAlarmSettings() abre la pantalla del sistema
//   «Alarmas y recordatorios» (RF-13): el permiso no es legible ni solicitable
//   desde JS (decisión técnica 9).
//
// Verificación de la ENTREGA con la app cerrada: development build (decisión 5);
// en Expo Go solo se puede comprobar el programado/cancelado (T9, T10) y el
// resto de la entrega real en T8.

import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import { getPhaseLabel, type Phase } from '../domain/cycle';

/** Canal de alarma Android del fin de fase (RF-2, RF-3, RF-12). */
const ALARM_CHANNEL_ID = 'phase-alarm';

/** Categoría de la notificación con la acción «Detener» (RF-7). */
const PHASE_END_CATEGORY_ID = 'phase-end';

/** Identificador de la acción «Detener» dentro de la categoría (RF-7). */
const STOP_ACTION_ID = 'stop';

/**
 * De dónde viene el aviso atendido (RF-7 vs RF-8):
 * - 'detener': el usuario pulsó «Detener» en la notificación (el wrapper ya
 *   descartó el aviso activo).
 * - 'notificacion': toque normal en la notificación; la pantalla muestra la
 *   fase terminada sin vista de alarma.
 */
export type AvisoOrigen = 'detener' | 'notificacion';

/** Evento que recibe la pantalla al atender el aviso de fin de fase. */
export interface AvisoEvento {
  origen: AvisoOrigen;
}

/**
 * Configura el handler que decide si una notificación recibida se muestra.
 * Sin handler, SDK 57 NO muestra nada (el comportamiento por defecto es
 * descartarla). Debe llamarse una sola vez, al montar la app.
 * Suena con el tono por defecto (spec 004, RF-2: aviso audible).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Crea (o reconfigura) el canal de alarma Android «phase-alarm» (spec 004, T4):
 * importancia MAX para el aviso emergente, tono por defecto del sistema,
 * audioAttributes.usage = ALARM para sonar en el stream de alarma —suena en
 * modo silencio (RF-3, decisión 1)—, vibración y contenido visible en la
 * pantalla de bloqueo (RF-3). En iOS no hace nada (las canales son de Android;
 * la propia librería es no-op fuera de Android). Idempotente: al montar.
 */
export async function configureAlarmChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Aviso de fin de fase',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      vibrationPattern: [0, 500, 500, 500],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // Mejor esfuerzo: sin canal propio sigue existiendo el canal por defecto.
  }
}

/**
 * Crea la categoría «phase-end» con la acción «Detener» (spec 004, T4, RF-7):
 * el botón aparece en la vista expandida de la notificación y en la pantalla
 * de bloqueo, y abre la app en primer plano. Android e iOS.
 */
export async function configureStopCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(PHASE_END_CATEGORY_ID, [
      {
        identifier: STOP_ACTION_ID,
        buttonTitle: 'Detener',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch {
    // Mejor esfuerzo: sin categoría, el toque normal sigue abriendo la app.
  }
}

/**
 * Programa el aviso de fin de fase en el timestamp absoluto de fin (RF-4, RF-5),
 * en el canal de alarma «phase-alarm» (RF-2, RF-3, RF-12) y con la categoría
 * «phase-end» de la acción «Detener» (RF-7). Textos en español; el cuerpo
 * identifica la fase con su etiqueta.
 */
export async function scheduleEndOfPhaseNotification(
  phase: Phase,
  endTimestampMs: number,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Fin de fase',
        body: `${getPhaseLabel(phase)} terminado. Toca para continuar tu sesión.`,
        categoryIdentifier: PHASE_END_CATEGORY_ID,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endTimestampMs,
        channelId: ALARM_CHANNEL_ID,
      },
    });
  } catch {
    // Sin permiso o fallo de plataforma: el temporizador es exacto igual (decisión 4).
  }
}

/** Cancela todos los avisos programados: pausa, reinicio o fin de fase (RF-10). */
export async function cancelScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Mejor esfuerzo: un aviso no cancelado no altera el cálculo del tiempo.
  }
}

/** ¿El sistema permite mostrar notificaciones ahora mismo? (RF-11) */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    // Estado REAL del sistema (decisión T10): permiso concedido (Android de
    // fábrica/iOS) O interruptor de notificaciones encendido en Ajustes
    // (android.importance > 0; 0 = IMPORTANCE_NONE = apagadas). Cubre el caso
    // Android 13+ con fabricantes que dejan importance > 0 sin conceder el
    // permiso: «desactivadas» solo si están apagadas de verdad.
    return settings.granted === true || (settings.android?.importance ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Pide el permiso de notificaciones; devuelve si quedó concedido (RF-11). */
export async function requestPermissions(): Promise<boolean> {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    return settings.granted === true;
  } catch {
    return false;
  }
}

/**
 * Corta el aviso ACTIVO (sonido, vibración y notificación) (spec 004, T4,
 * RF-7): lo llaman «Detener» de la notificación y el «Detener» de la vista de
 * alarma en primer plano. Mejor esfuerzo: si falla, el aviso se retira solo
 * al atenderlo.
 */
export async function dismissActiveAlarm(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Mejor esfuerzo: no corta el aviso, pero nada más depende de esto.
  }
}

/**
 * Escucha el aviso de fin de fase y distingue cómo se atendió (spec 004, T4):
 * - acción «Detener» (RF-7): descarta el aviso activo (corta sonido y
 *   vibración) y notifica { origen: 'detener' }.
 * - toque normal en la notificación (RF-8): notifica { origen: 'notificacion' }
 *   sin tocar el aviso; la pantalla muestra la fase terminada.
 * Devuelve la suscripción para quitarla al desmontar.
 */
export function addEndOfPhaseResponseListener(
  listener: (evento: AvisoEvento) => void,
): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (response?.actionIdentifier === STOP_ACTION_ID) {
      await dismissActiveAlarm();
      listener({ origen: 'detener' });
      return;
    }
    listener({ origen: 'notificacion' });
  });
}

/**
 * Abre la pantalla del sistema «Alarmas y recordatorios» (spec 004, cambio 1,
 * RF-13): el permiso de alarmas exactas no es legible ni solicitable desde JS
 * (decisión técnica 9), así que la app lleva al alumno a los ajustes donde lo
 * activa. Mejor esfuerzo: si el sistema no puede abrir la pantalla, el error se
 * traga y el flujo continúa (RF-14: nunca bloquea el temporizador).
 */
export async function openExactAlarmSettings(): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  } catch {
    // Mejor esfuerzo: sin pantalla de ajustes la app sigue funcionando igual.
  }
}
