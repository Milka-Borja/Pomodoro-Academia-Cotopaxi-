// Envoltorio de AsyncStorage para la sesión del Pomodoro (spec 003, T5; flags
// del permiso de la spec 004, T3).
// Único punto de la app que toca AsyncStorage (principio 3): la lógica pura de
// serialización/validación vive en sessionCodec.ts, que es testeable sin mocks.
//
// - La sesión se guarda en SESSION_KEY como JSON del CycleState, con timestamps
//   ABSOLUTOS (decisión 1): el restante al reabrir es exacto sin importar cuánto
//   tiempo haya pasado con la app cerrada o el celular apagado (RF-1, RF-2, RF-12).
// - SETTINGS_KEY guarda los ajustes personalizados de la técnica (spec 005, RF-2);
//   la serialización/validación vive en settingsCodec.ts.
// - NOTIFICATIONS_INFORMED_KEY guarda el flag «ya se informó una vez de que las
//   notificaciones están desactivadas» para no repetir el aviso (RF-11, decisión 4).
// - PERMISSION_ASKED_KEY guarda el flag «ya se pidió el permiso de notificaciones
//   alguna vez» para no volver a mostrar la explicación ni a solicitarlo (RF-10,
//   RF-11, spec 004 T3).
// - EXACT_ALARM_INVITED_KEY / EXACT_ALARM_INFORMED_KEY guardan los flags «ya se
//   mostró la invitación a «Alarmas y recordatorios»» y «ya se informó del riesgo
//   de un aviso no puntual» (spec 004 T9, cambio 1: RF-13, RF-14), para invitar
//   exactamente una vez por instalación y no volver a insistir.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CycleState } from '../domain/cycle';
import type { PomodoroSettings } from '../domain/settings';
import { parseStoredCycleState, serializeCycleState } from './sessionCodec';
import { parseStoredSettings, serializeSettings } from './settingsCodec';

/** Clave de la sesión guardada (fase + temporizador + contador + awaiting). */
export const SESSION_KEY = '@pomodoro/session';

/** Clave de los ajustes personalizados (spec 005, RF-2). */
export const SETTINGS_KEY = '@pomodoro/settings';

/** Clave del flag «ya se informó de notificaciones desactivadas». */
export const NOTIFICATIONS_INFORMED_KEY = '@pomodoro/notif-informed';

/** Clave del flag «ya se pidió el permiso de notificaciones alguna vez». */
export const PERMISSION_ASKED_KEY = '@pomodoro/permission-asked';

/** Clave del flag «ya se mostró la invitación a «Alarmas y recordatorios»». */
export const EXACT_ALARM_INVITED_KEY = '@pomodoro/exact-alarm-invited';

/** Clave del flag «ya se informó del riesgo de un aviso no puntual». */
export const EXACT_ALARM_INFORMED_KEY = '@pomodoro/exact-alarm-informed';

/**
 * Persiste el estado de la sesión. Ante un error de storage se traga la excepción
 * (una sesión no persistida no debe romper la app en vivo); la exactitud del
 * temporizador en memoria no depende de este guardado.
 */
export async function saveCycleState(state: CycleState): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, serializeCycleState(state));
  } catch {
    // Mejor esfuerzo: no se persiste, pero la app sigue funcionando.
  }
}

/**
 * Carga la sesión guardada. Devuelve `null` si no hay nada o si el dato está
 * corrupto/inválido (el codec valida), para que la pantalla arranque en el estado
 * inicial en vez de fallar (RF-2, RF-12).
 */
export async function loadCycleState(): Promise<CycleState | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return parseStoredCycleState(raw);
  } catch {
    return null;
  }
}

/**
 * Persiste los ajustes personalizados bajo SETTINGS_KEY (spec 005, RF-2).
 * Igual que la sesión: ante un error de storage se traga la excepción (mejor
 * esfuerzo); una configuración no persistida no debe romper la app en vivo.
 */
export async function saveSettings(settings: PomodoroSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, serializeSettings(settings));
  } catch {
    // Mejor esfuerzo: no se persiste, pero la app sigue funcionando.
  }
}

/**
 * Carga los ajustes guardados. Devuelve `null` si no hay nada o si el dato
 * está corrupto/inválido (el codec valida campo por campo), para que la
 * pantalla arranque con los defaults de la técnica (RF-2, Decisión 6).
 */
export async function loadSettings(): Promise<PomodoroSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return parseStoredSettings(raw);
  } catch {
    return null;
  }
}

/**
 * ¿Ya se informó al usuario, una única vez, que las notificaciones están
 * desactivadas? (RF-11, decisión 4.) Ausente o error → false.
 */
export async function hasInformedNotificationsDisabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_INFORMED_KEY);
    return value !== null;
  } catch {
    return false;
  }
}

/** Marca que el aviso único de «notificaciones desactivadas» ya se mostró (RF-11). */
export async function setNotificationsDisabledInformed(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_INFORMED_KEY, 'true');
  } catch {
    // Mejor esfuerzo: ante un fallo se volvería a informar en el próximo arranque.
  }
}

/**
 * ¿Ya se pidió el permiso de notificaciones alguna vez? (spec 004, T3; RF-10,
 * RF-11, decisión 5.) Ausente o error → false: la primera vez se explica antes
 * de pedir; después nunca más se insiste.
 */
export async function hasAskedNotificationPermission(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
    return value !== null;
  } catch {
    return false;
  }
}

/**
 * Marca que el diálogo del sistema de permiso ya se disparó (spec 004, T3,
 * RF-10, RF-11): a partir de ahí la app no vuelve a explicar ni a solicitar.
 */
export async function setNotificationPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
  } catch {
    // Mejor esfuerzo: ante un fallo se volvería a pedir en el próximo arranque.
  }
}

/**
 * ¿Ya se mostró la invitación a «Alarmas y recordatorios»? (spec 004, T9,
 * cambio 1; RF-13, RF-14.) Ausente o error → false: la app puede volver a
 * invitar como mucho una vez por fallo de storage, nunca reiterar.
 */
export async function hasSeenExactAlarmInvitation(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(EXACT_ALARM_INVITED_KEY);
    return value !== null;
  } catch {
    return false;
  }
}

/**
 * Marca que la invitación única a «Alarmas y recordatorios» ya se mostró
 * (spec 004, T9, cambio 1; RF-13, RF-14): a partir de ahí no se vuelve a invitar.
 */
export async function setExactAlarmInvitationSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(EXACT_ALARM_INVITED_KEY, 'true');
  } catch {
    // Mejor esfuerzo: ante un fallo se invitaría solo una vez más, sin reiterar.
  }
}

/**
 * ¿Ya se informó del riesgo de un aviso no puntual? (spec 004, T9, cambio 1;
 * RF-14.) Ausente o error → false: el informe es único, como el de RF-11.
 */
export async function hasInformedExactAlarmRisk(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(EXACT_ALARM_INFORMED_KEY);
    return value !== null;
  } catch {
    return false;
  }
}

/**
 * Marca que el informe único de riesgo ya se mostró (spec 004, T9, cambio 1;
 * RF-14): a partir de ahí la app no vuelve a informar.
 */
export async function setExactAlarmRiskInformed(): Promise<void> {
  try {
    await AsyncStorage.setItem(EXACT_ALARM_INFORMED_KEY, 'true');
  } catch {
    // Mejor esfuerzo: ante un fallo se informaría solo una vez más, sin reiterar.
  }
}
