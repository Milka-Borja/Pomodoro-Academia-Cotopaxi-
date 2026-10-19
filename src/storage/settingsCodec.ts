// Codec de los ajustes del Pomodoro (spec 005, T3). Puro: NO importa
// AsyncStorage ni React; solo transforma PomodoroSettings ⇄ JSON. La
// lectura/escritura reales viven en cycleStorage.ts, el único punto que toca
// AsyncStorage (principio 3).
//
// La validación es estricta campo por campo, sin coercionar: el dato guardado
// debe ser exactamente un entero dentro del rango de cada campo; si algo no
// encaja, se devuelve null y la pantalla arranca con DEFAULT_SETTINGS (RF-2).

import {
  SETTINGS_RANGES,
  type PomodoroSettings,
  type SettingsField,
} from '../domain/settings';

const SETTINGS_FIELDS: readonly SettingsField[] = [
  'studyMinutes',
  'shortBreakMinutes',
  'longBreakMinutes',
  'pomodorosPerCycle',
];

/** Serializa los ajustes a JSON para persistirlos. */
export function serializeSettings(settings: PomodoroSettings): string {
  return JSON.stringify(settings);
}

/**
 * Parsea y valida los ajustes guardados. Devuelve `null` (nunca lanza) ante
 * cualquier dato corrupto, incompleto, no entero o fuera de rango, para que la
 * app nunca crashee por un ajuste guardado: se cae a los defaults (RF-2).
 */
export function parseStoredSettings(raw: string | null): PomodoroSettings | null {
  if (raw === null || raw === '') {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null; // JSON roto
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const candidate = data as Record<string, unknown>;
  const resultado: Partial<PomodoroSettings> = {};
  for (const campo of SETTINGS_FIELDS) {
    const valor = leerEntero(candidate[campo], campo);
    if (valor === null) return null; // campo ausente, no entero o fuera de rango
    resultado[campo] = valor;
  }

  // Las claves extra se ignoran: solo se leen los 4 campos conocidos.
  return resultado as PomodoroSettings;
}

/**
 * Lee un campo como entero estricto dentro de su rango: sin coercionar
 * (un «25» en texto o un 25.5 no valen, RF-12) y sin aceptar 0 ni números
 * fuera de los límites del campo (RF-10).
 */
function leerEntero(valor: unknown, campo: SettingsField): number | null {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return null;
  const { min, max } = SETTINGS_RANGES[campo];
  if (valor < min || valor > max) return null;
  return valor;
}
